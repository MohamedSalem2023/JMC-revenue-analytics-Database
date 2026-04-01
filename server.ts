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
  console.error("MONGODB_URI environment variable is not set.");
  process.exit(1);
}

// تنظيف الرابط من أي رموز زائدة
if (uri.includes("<") || uri.includes(">")) {
  console.log("Cleaning MONGODB_URI: removing < and > symbols.");
  uri = uri.replace(/<|>/g, "");
}

let client: MongoClient;
let db: any;

async function getDb() {
  console.log("getDb called. Current client state:", client ? "initialized" : "null");
  if (!client) {
    console.log("Initializing MongoClient...");
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
    console.log("Pinging MongoDB...");
    await client.db("admin").command({ ping: 1 });
    console.log("Ping successful.");
    db = client.db("JMSRevenueAnalysis");
    return db;
  } catch (error: any) {
    console.error("MongoDB connection error:", error.message);
    // محاولة إعادة الاتصال في حال الفشل
    client = new MongoClient(uri as string, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
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
app.get("/api/data", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    console.log("Fetching data...");
    const chunks = await collection.find({}).sort({ index: 1 }).allowDiskUse().toArray();
    
    if (chunks.length === 0) {
      return res.json({ data: null });
    }

    const allData = chunks.reduce((acc: any[], chunk: any) => {
      try {
        const parsed = typeof chunk.data === 'string' ? JSON.parse(chunk.data) : chunk.data;
        return acc.concat(parsed);
      } catch (e) {
        return acc;
      }
    }, []);

    res.json({ data: allData });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// باقي الـ APIs (Upload, Clear, etc.) تبقى كما هي...
app.post("/api/data/upload", async (req, res) => {
  try {
    const { chunks } = req.body;
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    await collection.deleteMany({});
    if (chunks.length > 0) {
      await collection.insertMany(chunks.map((chunk, index) => ({
        index, data: JSON.stringify(chunk), timestamp: new Date()
      })));
    }
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();