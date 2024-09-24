import { CohereEmbeddings } from "@langchain/cohere";
import {
  Pinecone,
  PineconeRecord,
  RecordMetadata,
} from "@pinecone-database/pinecone";
import { Context } from "hono";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { traceable } from "langsmith/traceable";
import { Bindings } from "..";

// Create a type-safe wrapper for traceable
function traceableFunction<T extends (...args: never[]) => unknown>(
  fn: T,
  options: { name: string }
): T {
  return traceable(fn, options) as unknown as T;
}

export const createPineconeIndex = traceableFunction(
  async (client: Pinecone, indexName: string, vectorDimension: number) => {
    console.log(`----Checking "${indexName}"...-----`);
    const existingIndexes = await client.listIndexes();
    if (!existingIndexes.indexes?.some((index) => index.name === indexName)) {
      console.log(`Creating "${indexName}"...`);
      await client.createIndex({
        name: indexName,
        dimension: vectorDimension,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(
        `Creating index.... please wait for it to finish initializing.`
      );
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute
    } else {
      console.log(`"${indexName}" already exists.`);
    }
  },
  { name: "createPineconeIndex" }
);

export const updatePineconeWithTranscription = traceableFunction(
  async (
    client: Pinecone,
    indexName: string,
    transcription: string,
    id: string,
    c: Context<{ Bindings: Bindings }>
  ) => {
    console.log("Retrieving Pinecone index...");
    const index = client.Index(indexName);
    console.log(`Pinecone index retrieved: ${indexName}`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 256,
      chunkOverlap: 25,
    });

    console.log("-----Splitting transcription into chunks...-----");
    const chunks = await textSplitter.createDocuments([transcription]);
    console.log(`-----Transcription split into ${chunks.length} chunks-----`);
    console.log(
      `-----Calling Cohere's Embedding endpoint for ${chunks.length} text chunks -----`
    );
    const embeddings = new CohereEmbeddings({
      apiKey: c.env.COHERE_API_KEY,
      model: "embed-english-v3.0",
      inputType: "search_document",
    });

    const embeddingsArrays = await embeddings.embedDocuments(
      chunks.map((chunk) => chunk.pageContent.replace(/\n/g, " "))
    );

    console.log("Finished embedding chunks");

    console.log(
      `Creating ${chunks.length} vectors array with id, values, and metadata...`
    );
    const batchSize = 100;
    let batch = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const vector = {
        id: `${id}_${idx}`,
        values: embeddingsArrays[idx],
        metadata: {
          videoId: id,
          pageContent: chunk?.pageContent,
          chunk: idx,
        },
      };
      batch.push(vector);

      if (batch.length === batchSize || idx === chunks.length - 1) {
        await index.upsert(batch as PineconeRecord<RecordMetadata>[]);
        batch = [];
      }
    }

    console.log(
      `Pinecone index updated with ${chunks.length} vectors for video ${id}`
    );
  },
  { name: "updatePineconeWithTranscription" }
);

export const queryPineconeForContext = traceableFunction(
  async (
    client: Pinecone,
    indexName: string,
    question: string,
    videoId: string,
    c: Context<{ Bindings: Bindings }>
  ) => {
    console.log(`Querying Pinecone index: ${indexName}`);
    console.log(`Question: ${question}`);
    console.log(`VideoId: ${videoId}`);

    const index = client.Index(indexName);

    const embeddings = new CohereEmbeddings({
      apiKey: c.env.COHERE_API_KEY,
      model: "embed-english-v3.0",
      inputType: "search_query",
    });

    console.log("Generating query embedding...");
    const queryEmbedding = await embeddings.embedQuery(question);

    try {
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
        filter: { videoId: { $eq: videoId } },
      });

      if (queryResponse.matches.length === 0) {
        console.log("No matches found. Trying query without filter...");
        const unfiltereedQueryResponse = await index.query({
          vector: queryEmbedding,
          topK: 5,
          includeMetadata: true,
        });
        console.log(
          "Unfiltered Query Response:",
          JSON.stringify(unfiltereedQueryResponse, null, 2)
        );
      }

      const relevantContext: string = queryResponse.matches
        .map((match) => match?.metadata?.pageContent as string)
        .join("\n");

      return relevantContext;
    } catch (error) {
      console.error("Error querying Pinecone:", error);
      throw error;
    }
  },
  { name: "queryPineconeForContext" }
);
