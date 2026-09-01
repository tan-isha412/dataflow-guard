// Keeps the last 4 characters visible — "card ending in 0366" is
// often more useful for a human reviewer than a fully blacked-out value.
export function partialMaskStrategy(detection, originalValue) {
  const visibleCount = 4;
  if (originalValue.length <= visibleCount) {
    return "*".repeat(originalValue.length);
  }
  const masked = "*".repeat(originalValue.length - visibleCount);
  const visible = originalValue.slice(-visibleCount);
  return masked + visible;
}