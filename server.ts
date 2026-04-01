import express from "express";
import path from "path";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// تنظيف رابط MongoDB من أي رموز زائدة
const MONGODB_URI = process.env.MONGODB_URI?.replace('<', '').replace('>', '') || "mongodb://localhost:27017";

let dbClient: MongoClient | null = null;

async function getDb() {
  if (!dbClient) {
    dbClient = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    await dbClient.connect();
    console.log("Successfully connected to MongoDB!");
  }
  return dbClient.db("JMSRevenueAnalysis");
}

app.use(express.json({ limit: "50mb" }));

// API لجلب البيانات
app.get("/api/data", async (req, res) => {
  try {
    const db = await getDb();
    const collection = db.collection("revenue_data");
    
    console.log("Fetching data from MongoDB...");
    const chunks = await collection.find({}).sort({ index: 1 }).toArray();
    
    if (chunks.length === 0) {
      console.log("No data found in database.");
      return res.json({ data: [] });
    }

    console.log(`Found ${chunks.length} chunks. Reassembling...`);
    
    const allData = chunks.reduce((acc: any[], chunk: any) => {
      try {
        const parsed = typeof chunk.data === 'string' ? JSON.parse(chunk.data) : chunk.data;
        return [...acc, ...parsed];
      } catch (e) {
        console.error("Error parsing chunk:", e);
        return acc;
      }
    }, []);

    console.log(`Successfully reassembled ${allData.length} rows.`);
    res.json({ data: allData });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    // نرسل رسالة الخطأ الحقيقية للمتصفح لنعرف السبب
    res.status(500).json({ error: error.message || "Failed to fetch data" });
  }
});

// API لحفظ البيانات (Chunks)
app.post("/api/data", async (req, res) => {
  try {
    const { chunks } = req.body;
    if (!Array.isArray(chunks)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const db = await getDb();
    const collection = db.collection("revenue_data");

    await collection.deleteMany({});
    await collection.insertMany(chunks.map((data, index) => ({ data, index, timestamp: new Date() })));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: error.message });
  }
});

// API لمسح البيانات
app.delete("/api/data", async (req, res) => {
  try {
    const db = await getDb();
    await db.collection("revenue_data").deleteMany({});
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// إعداد Vite للمنتج (Production)
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // تحميل Vite ديناميكياً فقط في التطوير لتوفير الذاكرة
  const startVite = async () => {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  };
  startVite();
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});