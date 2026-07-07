export function getQuestionLetter(num: number): string {
  if (num <= 0) return num.toString();
  let letter = "";
  let temp = num;
  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}
