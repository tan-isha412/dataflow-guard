import { AppError } from "../../middleware/errorHandler.js";
import { findUserById, updateUserProfile } from "./users.repository.js";

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return user;
}

export async function updateCurrentUser(userId, updates) {
  return updateUserProfile(userId, updates);
}