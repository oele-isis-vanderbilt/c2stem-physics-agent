// Mastery as the number of items in `keys` that scored 1 (same as the truck scorer)
export default function mastery(score, keys) {
  return keys.filter((key) => score[key] === 1).length;
}
