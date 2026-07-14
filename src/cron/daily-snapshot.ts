import { crawlAll } from "@/lib/crawl";

async function main() {
  console.log("=== Daily Snapshot ===");
  console.log("Time:", new Date().toISOString());

  const result = await crawlAll();
  console.log(`Success: ${result.success}, Failed: ${result.failed}`);
  if (result.errors.length > 0) {
    console.log("Errors:", result.errors);
  }
  console.log("======================");
}

main()
  .then(() => {
    console.log("Crawl completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Crawl crashed:", err);
    process.exit(1);
  });