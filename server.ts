import express from "express";
import { createServer as createViteServer } from "vite";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json({ limit: '500mb' })); // Increase limit for large JSON payloads
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// We will use the environment variable directly
let uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI environment variable is not set.");
  process.exit(1);
}

// Fix common mistake where users leave < and > around the password in the connection string
if (uri.includes("<") && uri.includes(">")) {
  uri = uri.replace("<", "").replace(">", "");
}

let client: MongoClient;
let db: any;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri as string, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
  }
  
  try {
    // Ping to check if connected/topology is open
    await client.db("admin").command({ ping: 1 });
    db = client.db("JMSRevenueAnalysis");
    return db;
  } catch (error: any) {
    console.error("MongoDB connection error details:");
    console.error("- Message:", error.message);
    console.error("- Code:", error.code);
    console.error("- CodeName:", error.codeName);
    
    // Recreate client if topology is closed or connection failed
    client = new MongoClient(uri as string, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
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
    
    // Create an index on the 'index' field to avoid in-memory sorting
    await collection.createIndex({ index: 1 });
    
    // Use allowDiskUse to prevent memory limit errors when sorting large datasets
    const chunks = await collection.find({}, { allowDiskUse: true }).sort({ index: 1 }).toArray();
    
    if (chunks.length === 0) {
      return res.json({ data: null });
    }

    // Reassemble chunks
    const allData = chunks.reduce((acc: any[], chunk: any) => {
      return acc.concat(JSON.parse(chunk.data));
    }, []);

    res.json({ data: allData });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
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

app.post("/api/data/upload", async (req, res) => {
  try {
    const { chunks } = req.body;
    
    if (!chunks || !Array.isArray(chunks)) {
      return res.status(400).json({ error: "Invalid chunks data" });
    }

    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    // Clear existing data
    await collection.deleteMany({});
    
    // Insert new chunks
    if (chunks.length > 0) {
      const documents = chunks.map((chunk, index) => ({
        index,
        data: JSON.stringify(chunk),
        timestamp: new Date()
      }));
      
      await collection.insertMany(documents);
    }

    res.json({ success: true, message: "Data uploaded successfully" });
  } catch (error) {
    console.error("Error uploading data:", error);
    res.status(500).json({ error: "Failed to upload data" });
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

  // Global error handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
