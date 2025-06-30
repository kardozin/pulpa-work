const spanishWords = [
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'un', 'ser', 'se', 'no', 'haber', 'por', 'con', 'su', 'para', 'como', 'estar',
  'tener', 'le', 'lo', 'todo', 'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese', 'si', 'me', 'ya',
  'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin', 'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo',
  'yo', 'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero', 'desde', 'grande', 'eso', 'ni', 'nos',
  'llegar', 'pasar', 'tiempo', 'ella', 'uno', 'bien', 'poco', 'deber', 'entonces', 'donde', 'ahora', 'parte', 'vida',
  'quedar', 'siempre', 'creer', 'hablar', 'llevar', 'dejar', 'nada', 'cada', 'seguir', 'parecer', 'nuevo', 'encontrar'
];
const englishWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good',
  'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also'
];

export const detectLanguage = (text: string): string => {
  const normalizedText = text.toLowerCase().replace(/[.,?¡¿!]/g, '');
  const words = normalizedText.split(/\s+/);
  if (words.length === 0) return 'en-US'; // Default

  let spanishScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (spanishWords.includes(word)) spanishScore++;
    if (englishWords.includes(word)) englishScore++;
  }

  const spanishRatio = spanishScore / words.length;
  const englishRatio = englishScore / words.length;

  if (spanishRatio > englishRatio && spanishRatio > 0.1) return 'es-AR';
  if (englishRatio > spanishRatio && englishRatio > 0.1) return 'en-US';
  
  return spanishScore >= englishScore ? 'es-AR' : 'en-US';
};
