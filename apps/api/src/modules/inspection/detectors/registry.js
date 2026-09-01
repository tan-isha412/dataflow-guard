import { detectEmails } from "./email.detector.js";
import { detectPhoneNumbers } from "./phone.detector.js";
import { detectCreditCards } from "./creditCard.detector.js";
import { detectAwsKeys } from "./awsKey.detector.js";
import { detectGithubTokens } from "./githubToken.detector.js";
import { detectJwts } from "./jwt.detector.js";
import { detectDbConnectionStrings } from "./dbConnString.detector.js";
import { detectGenericSecrets } from "./genericSecret.detector.js";
import { detectIpAddresses } from "./ipAddress.detector.js";

// This is the fix for Day 6's "TEMPORARY: hardcoded list" comment.
// Every fixed-pattern detector is just a function that takes text
// and returns detections — so they can all sit in one array and be
// run in a loop. Adding detector #10 later means adding ONE line
// here, not touching inspection.service.js at all.
export const DETECTOR_REGISTRY = [
  detectEmails,
  detectPhoneNumbers,
  detectCreditCards,
  detectAwsKeys,
  detectGithubTokens,
  detectJwts,
  detectDbConnectionStrings,
  detectGenericSecrets,
  detectIpAddresses
];

export function runAllDetectors(text) {
  return DETECTOR_REGISTRY.flatMap((detect) => detect(text));
}