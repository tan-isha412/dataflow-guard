// Standard Luhn checksum — used to tell a real credit card number
// apart from a random 16-digit string. Not a detector itself, just
// math the credit card detector relies on.
export function isValidLuhn(digitsOnly) {
  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = parseInt(digitsOnly[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}