import crypto from 'crypto';
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import fs from "fs";
import path from "path";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const APP_ID = process.env.APP_ID;
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH;

let encoder = new TextEncoder();

export async function addPRComment(repoName, prNumber, message, installationId) {

    const privateKeyPath = path.resolve(PRIVATE_KEY_PATH);
    const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: APP_ID,
          privateKey: privateKey,
          installationId,
        },
      });
    const url = `/repos/${repoName}/issues/${prNumber}/comments`;
    const comment = {
        body: message
    };

    await octokit.request('POST ' + url, comment);
}

export async function verifySignature(header, payload) {
    let parts = header.split("=");
    let sigHex = parts[1];

    let algorithm = { name: "HMAC", hash: { name: 'SHA-256' } };

    let keyBytes = encoder.encode(WEBHOOK_SECRET);
    let extractable = false;
    let key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        algorithm,
        extractable,
        [ "sign", "verify" ],
    );

    let sigBytes = hexToBytes(sigHex);
    let dataBytes = encoder.encode(payload);
    let equal = await crypto.subtle.verify(
        algorithm.name,
        key,
        sigBytes,
        dataBytes,
    );

    return equal;
};

function hexToBytes(hex) {
    let len = hex.length / 2;
    let bytes = new Uint8Array(len);

    let index = 0;
    for (let i = 0; i < hex.length; i += 2) {
        let c = hex.slice(i, i + 2);
        let b = parseInt(c, 16);
        bytes[index] = b;
        index += 1;
    }

    return bytes;
}