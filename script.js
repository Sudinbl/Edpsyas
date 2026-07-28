/* =========================================================
   CHATBOT INTERACTION SCRIPT (script.js)
   Uses Cloudflare Worker with local Knowledge Base (RAG)
   ========================================================= */

// Your Cloudflare Worker URL
const WORKER_URL = "https://edpsyaschatbot.sdbl-sdb-com.workers.dev/";

// Global variable to store loaded knowledge entries
let knowledge = [];

// 1. Initialize DOM events & Load Knowledge Base properly
document.addEventListener('DOMContentLoaded', async () => {
    
    // Await knowledge base loading before binding actions
    await loadKnowledge();

    const inputField = document.getElementById('userInput');
    const sendButton = document.querySelector('.input-area button');

    if (inputField) {
        inputField.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

});

/**
 * Loads the local knowledge.json file
 */
async function loadKnowledge() {
    try {
        const response = await fetch("knowledge.json");
        if (!response.ok) {
            throw new Error(`Failed to load knowledge base: ${response.statusText}`);
        }
        knowledge = await response.json();
        console.log("Knowledge Base loaded successfully:", knowledge.length, "entries.");
    } catch (error) {
        console.error("Error loading knowledge.json:", error);
    }
}

/**
 * Smart Search with weighted scoring for Title, Keywords, and Content
 */
function searchKnowledge(query) {
    if (!knowledge || knowledge.length === 0) return null;

    // Clean query
    const cleanQuery = (query || "").toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (!cleanQuery) return null;

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
            // Priority scoring: Title (+5), Keywords (+3), Content (+1)
            if (titleText.includes(term)) score += 5;
            if (keywordText.includes(term)) score += 3;
            if (contentText.includes(term)) score += 1;
        });

        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    return highestScore > 0 ? bestMatch : null;
}

/**
 * Sends the user message with Knowledge Base verification
 */
async function sendMessage() {

    const inputField = document.getElementById('userInput');
    if (!inputField) return;

    const userText = inputField.value.trim();

    if (userText === "") return;

    renderUserMessage(userText);
    inputField.value = "";
    scrollToBottom();

    // Search knowledge base using keyword scoring algorithm
    const matchedItem = searchKnowledge(userText);

    if (!matchedItem) {
        renderBotMessage("Sorry, I couldn't find that topic in the EdPsyAs knowledge base.");
        scrollToBottom();
        return;
    }

    const typingIndicator = showTypingIndicator();

    try {
        // Pass structured prompt context to Gemini
        const botResponse = await fetchGeminiResponse(matchedItem, userText);

        typingIndicator.remove();
        renderBotMessage(botResponse);

    } catch (error) {

        typingIndicator.remove();
        renderBotMessage("⚠️ " + error.message);

    }

    scrollToBottom();

}

/**
 * Formats payload with context/rules and calls Cloudflare Worker
 */
async function fetchGeminiResponse(matchedItem, userPrompt) {

    const formattedPrompt = `Knowledge Base

Title:
${matchedItem.title}

Content:
${matchedItem.content}

Student Question:
${userPrompt}

Rules:
1. Answer ONLY using the above content.
2. Never use outside knowledge.
3. Keep the response concise, clear, and easy to read (under 150 words).
4. Format key takeaways cleanly using clear bullet points.
5. Provide the source link at the end: ${matchedItem.url || "N/A"}`;

    const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: formattedPrompt
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }

    const data = await response.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        console.log("Full Gemini API Response Payload:", data);
        throw new Error("Gemini returned an empty response.");
    }

    return text;

}

/**
 * User Bubble
 */
function renderUserMessage(text) {

    const chatWindow = document.getElementById('chatWindow');

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper user-wrapper';

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message user-message';
    messageBubble.textContent = text;

    wrapper.appendChild(messageBubble);
    chatWindow.appendChild(wrapper);

}

/**
 * AI Bubble (Parses Markdown into rendered HTML)
 */
function renderBotMessage(text) {

    const chatWindow = document.getElementById('chatWindow');

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot-wrapper';

    const avatar = document.createElement('div');
    avatar.className = 'bot-avatar';

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message bot-message';

    // Renders Markdown headings and bullet points cleanly if Marked library is available
    if (typeof marked !== 'undefined') {
        messageBubble.innerHTML = marked.parse(text);
    } else {
        messageBubble.textContent = text;
    }

    wrapper.appendChild(avatar);
    wrapper.appendChild(messageBubble);

    chatWindow.appendChild(wrapper);

}

/**
 * Thinking Bubble
 */
function showTypingIndicator() {

    const chatWindow = document.getElementById('chatWindow');

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot-wrapper typing-wrapper';

    const avatar = document.createElement('div');
    avatar.className = 'bot-avatar';

    const bubble = document.createElement('div');
    bubble.className = 'message bot-message';
    bubble.style.fontStyle = "italic";
    bubble.style.opacity = "0.7";
    bubble.textContent = "AI is thinking...";

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);

    chatWindow.appendChild(wrapper);

    scrollToBottom();

    return wrapper;

}

/**
 * Scroll Utility
 */
function scrollToBottom() {

    const chatWindow = document.getElementById('chatWindow');
    if (chatWindow) {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

}
