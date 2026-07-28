/**
 * Smart Search with weighted scoring for Title, Keywords, and Content
 */
function searchKnowledge(query) {
    if (!knowledge || knowledge.length === 0) return null;

    // Clean query
    const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, "");
    const words = cleanQuery.split(/\s+/);

    const stopWords = [
        "what", "is", "the", "of", "a", "an", "define", "explain",
        "tell", "me", "about", "who", "why", "how", "does", "can", "you", "give"
    ];

    // Filter out stop words (allow words with length >= 2)
    const searchTerms = words.filter(word => word.length >= 2 && !stopWords.includes(word));

    if (searchTerms.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const item of knowledge) {
        let score = 0;

        const titleText = (item.title || "").toLowerCase();
        const contentText = (item.content || "").toLowerCase();
        
        let keywordText = "";
        if (Array.isArray(item.keywords)) {
            keywordText = item.keywords.join(" ").toLowerCase();
        } else if (typeof item.keywords === 'string') {
            keywordText = item.keywords.toLowerCase();
        }

        searchTerms.forEach(term => {
            // Give highest priority if the word is in Title (+5)
            if (titleText.includes(term)) {
                score += 5;
            }
            // High priority if in Keywords array (+3)
            if (keywordText.includes(term)) {
                score += 3;
            }
            // Standard priority if in Content (+1)
            if (contentText.includes(term)) {
                score += 1;
            }
        });

        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    // Require at least a match score of 1
    return highestScore > 0 ? bestMatch : null;
}
