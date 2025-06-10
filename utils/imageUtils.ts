export function getImageName(categoryCount: any, mycategory: any) {
  if (!categoryCount[mycategory]) {
    categoryCount[mycategory] = 0;
  }

  // Increment count and reset to 1 if it exceeds 7
  categoryCount[mycategory] = (categoryCount[mycategory] % 7) + 1;

  return `${mycategory.replace(/\s+/g, '-').toLowerCase()}-${
    categoryCount[mycategory]
  }.png`;
}
