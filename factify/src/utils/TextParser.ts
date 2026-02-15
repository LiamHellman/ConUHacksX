export const parseTextForBias = (text: string) => {
  //segement into segments
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  const sentenceSegments = segmenter.segment(text);

  // feed into array
  const sentences = Array.from(sentenceSegments).map((s) => s.segment.trim());

  // segment into partaggrapohs
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return { sentences, paragraphs };
};
