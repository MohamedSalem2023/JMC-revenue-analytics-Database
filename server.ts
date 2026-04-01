import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json({ limit: '500mb' })); // زيادة الحد لاستيعاب البيانات الكبيرة
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// استخدام متغير البيئة مباشرة
let uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI environment variable is not set.");
  process.exit(1);
}

// تنظيف الرابط من الرموز الزائدة < و > التي قد يتركها المستخدم بالخطأ
if (uri.includes("<") || uri.includes(">")) {
  console.log("Cleaning MONGODB_URI: removing < and > symbols.");
  uri = uri.replace(/<|>/g, "");
}

let client: MongoClient;
let db: any;

async function getDb() {
  console.log("getDb called. Current client state:", client ? "initialized" : "null");
  if (!client) {
    console.log("Initializing MongoClient with URI...");
    client = new MongoClient(uri as string, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  }
  
  try {
    console.log("Pinging MongoDB admin database...");
    await client.db("admin").command({ ping: 1 });
    console.log("Ping successful. Accessing JMSRevenueAnalysis database...");
    db = client.db("JMSRevenueAnalysis");
    return db;
  } catch (error: any) {
    console.error("MongoDB connection/ping error details:");
    console.error("- Message:", error.message);
    console.error("- Code:", error.code);
    
    console.log("Attempting to recreate MongoClient due to error...");
    client = new MongoClient(uri as string, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    db = client.db("JMSRevenueAnalysis");
    return db;
  }
}

async function connectToMongo() {
  try {
    await getDb();
    console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB on startup:", error);
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/data", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    console.log("Fetching data from MongoDB...");
    // استخدام allowDiskUse لتجنب أخطاء الذاكرة عند فرز البيانات الكبيرة
    const chunks = await collection.find({}).sort({ index: 1 }).allowDiskUse().toArray();
    
    console.log(`Found ${chunks.length} chunks in database.`);

    if (chunks.length === 0) {
      console.log("No data found in revenue_chunks collection.");
      return res.json({ data: null });
    }

    // إعادة تجميع الأجزاء (Chunks)
    const allData = chunks.reduce((acc: any[], chunk: any) => {
      try {
        const parsed = typeof chunk.data === 'string' ? JSON.parse(chunk.data) : chunk.data;
        return acc.concat(parsed);
      } catch (e) {
        console.error("Error parsing chunk data at index", chunk.index, ":", e);
        return acc;
      }
    }, []);

    console.log(`Successfully reassembled ${allData.length} rows.`);
    res.json({ data: allData });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: error.message || "Failed to fetch data" });
  }
});

app.post("/api/data/upload-chunk", async (req, res) => {
  try {
    const { chunk, index } = req.body;
    
    if (!chunk || !Array.isArray(chunk)) {
      return res.status(400).json({ error: "Invalid chunk data" });
    }

    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    await collection.insertOne({
      index,
      data: JSON.stringify(chunk),
      timestamp: new Date()
    });

    res.json({ success: true, message: `Chunk ${index} uploaded successfully` });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    res.status(500).json({ error: "Failed to upload chunk" });
  }
});

app.delete("/api/data/clear", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    await collection.deleteMany({});
    res.json({ success: true, message: "Data cleared successfully" });
  } catch (error) {
    console.error("Error clearing data:", error);
    res.status(500).json({ error: "Failed to clear data" });
  }
});

async function startServer() {
  await connectToMongo();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // معالج أخطاء عالمي لضمان استجابات JSON
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();