// Function to calculate the sum of an array of numbers
function sum(numbers: number[]): number {
  return numbers.reduce((acc, current) => acc + current, 0);
}

// Test the sum function with a sample array
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const result = sum(numbers);

console.log(`The sum of [${numbers.join(",")}] is: ${result}`);
