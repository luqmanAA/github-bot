import crypto from 'crypto';
import { Octokit } from "@octokit/core";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

let encoder = new TextEncoder();

export async function addPRComment(repoName, prNumber, message) {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });
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