import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

let uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is missing!");
  process.exit(1);
}

// تنظيف الرابط
uri = uri.replace(/<|>/g, "");

let client: MongoClient | null = null;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri as string, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 10,
    });
    await client.connect();
  }
  return client.db("JMSRevenueAnalysis");
}

// API جلب البيانات - باستخدام تقنية البث (Streaming) لحل مشكلة 502
app.get("/api/data", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    // 1. حل مشكلة MongoDB Sort Memory Limit بإنشاء Index
    await collection.createIndex({ index: 1 });
    
    const count = await collection.countDocuments();
    if (count === 0) {
      return res.json({ data: null });
    }

    // 2. حل مشكلة 502 Bad Gateway (OOM) باستخدام الـ Streaming
    // نرسل البيانات كقطار متصل بدلاً من وضعها كلها في الذاكرة
    res.setHeader('Content-Type', 'application/json');
    res.write('{"data":[');
    
    const cursor = collection.find({}).sort({ index: 1 });
    let isFirst = true;
    
    for await (const chunk of cursor) {
      let dataStr = "";
      if (typeof chunk.data === 'string') {
        dataStr = chunk.data.trim();
      } else if (Array.isArray(chunk.data)) {
        dataStr = JSON.stringify(chunk.data);
      }
      
      if (dataStr) {
        // إزالة الأقواس المربعة من البداية والنهاية لدمج المصفوفات
        if (dataStr.startsWith('[')) dataStr = dataStr.substring(1);
        if (dataStr.endsWith(']')) dataStr = dataStr.substring(0, dataStr.length - 1);
        
        if (dataStr.length > 0) {
          if (!isFirst) res.write(',');
          res.write(dataStr);
          isFirst = false;
        }
      }
    }
    
    res.write(']}');
    res.end();
  } catch (error: any) {
    console.error("Fetch error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

app.post("/api/data/upload-chunk", async (req, res) => {
  try {
    const { chunk, index } = req.body;
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    if (index === 0) {
      await collection.deleteMany({});
    }

    await collection.insertOne({ 
      index, 
      data: JSON.stringify(chunk), 
      timestamp: new Date() 
    });
    
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
  try {
    await getDb();
    console.log("Connected to MongoDB");
  } catch (e) {
    console.error("Initial connection failed");
  }

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
    console.log(`Server ready on port ${PORT}`);
  });
}

startServer();
