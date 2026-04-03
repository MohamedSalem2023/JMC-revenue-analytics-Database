import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

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

if (uri.includes("<") || uri.includes(">")) {
  console.log("Cleaning MONGODB_URI: removing < and > symbols.");
  uri = uri.replace(/<|>/g, "");
}

let client: MongoClient;
let db: any;

async function getDb() {
  if (db) return db;
  
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      const maskedUri = (uri as string).replace(/:([^@]+)@/, ":****@");
      console.log(`Attempt ${i + 1} to connect to MongoDB with URI: ${maskedUri}`);
      
      client = new MongoClient(uri as string, {
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4, // Force IPv4 to avoid resolution issues on some cloud platforms
      });
      
      await client.connect();
      console.log("Successfully connected to MongoDB!");
      db = client.db("JMSRevenueAnalysis");
      return db;
    } catch (error: any) {
      lastError = error;
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error.message);
      if (i < 2) {
        console.log("Retrying in 5 seconds...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  console.error("All MongoDB connection attempts failed.");
  throw lastError;
}

async function connectToMongo() {
  try {
    await getDb();
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
    
    try {
      await collection.createIndex({ index: 1 });
    } catch (indexError) {
      console.warn("Could not create index on 'index' field:", indexError);
    }
    
    const cursor = collection.find({}).sort({ index: 1 }).allowDiskUse();
    const chunks = await cursor.toArray();
    
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
    res.status(500).json({ error: error.message || "Failed to fetch data" });
  }
});

app.post("/api/data/upload-chunk", async (req, res) => {
  try {
    const { chunk, index } = req.body;
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    await collection.insertOne({
      index,
      data: JSON.stringify(chunk),
      timestamp: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload chunk" });
  }
});

app.delete("/api/data/clear", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    await collection.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear data" });
  }
});

async function startServer() {
  await connectToMongo();

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

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();