import { randomInt } from "node:crypto";
import { LicenseType } from "@prisma/client";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BLOCK_LENGTH = 4;
const BLOCK_COUNT = 3;

function randomBlock() {
  let block = "";

  for (let index = 0; index < BLOCK_LENGTH; index += 1) {
    block += ALPHABET[randomInt(0, ALPHABET.length)];
  }

  return block;
}

export function generateLicenseKey(type: LicenseType = LicenseType.PRO) {
  const blocks = Array.from({ length: BLOCK_COUNT }, randomBlock);
  return ["47S", type, ...blocks].join("-");
}
