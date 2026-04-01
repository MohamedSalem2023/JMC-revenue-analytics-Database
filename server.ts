import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json({ limit: '500mb' })); 
app.use(express.urlencoded({ limit: '500mb', extended: true }));

let uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

if (uri.includes("<") || uri.includes(">")) {
  uri = uri.replace(/<|>/g, "");
}

let client: MongoClient;
let db: any;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri as string, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  }
  
  try {
    await client.db("admin").command({ ping: 1 });
    db = client.db("JMSRevenueAnalysis");
    return db;
  } catch (error: any) {
    client = new MongoClient(uri as string, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
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
    console.error("Error connecting to MongoDB:", error);
  }
}

// API جلب البيانات - تم التعديل هنا لحل مشكلة الذاكرة
app.get("/api/data", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    console.log("Fetching data from MongoDB...");
    
    // الحل: جلب البيانات بدون ترتيب من المونجو لتجنب خطأ الذاكرة
    const chunks = await collection.find({}).toArray();
    
    console.log(`Found ${chunks.length} chunks. Sorting in server memory...`);

    if (chunks.length === 0) {
      return res.json({ data: null });
    }

    // ترتيب البيانات داخل السيرفر (هذا لا يستهلك ذاكرة المونجو المحدودة)
    chunks.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

    // إعادة تجميع الأجزاء
    const allData = chunks.reduce((acc: any[], chunk: any) => {
      try {
        const parsed = typeof chunk.data === 'string' ? JSON.parse(chunk.data) : chunk.data;
        return acc.concat(parsed);
      } catch (e) {
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
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    await collection.insertOne({ index, data: JSON.stringify(chunk), timestamp: new Date() });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/data/clear", async (req, res) => {
  try {
    const database = await getDb();
    await database.collection("revenue_chunks").deleteMany({});
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  await connectToMongo();

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();