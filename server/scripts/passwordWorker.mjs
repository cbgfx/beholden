import { parentPort } from "node:worker_threads";
import bcrypt from "bcryptjs";

parentPort.on("message", ({ id, operation, password, hash }) => {
  try {
    const value = operation === "hash" ? bcrypt.hashSync(password, 10) : bcrypt.compareSync(password, hash);
    parentPort.postMessage({ id, value });
  } catch {
    // Never send passwords, hashes, or library error details back to the request thread.
    parentPort.postMessage({ id, error: "Password operation failed" });
  }
});
