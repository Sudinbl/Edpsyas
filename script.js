/* =========================================================
   CHATBOT INTERACTION SCRIPT (script.js)
   Uses Cloudflare Worker with local Knowledge Base (RAG)
   ========================================================= */

// Your Cloudflare Worker URL
const WORKER_URL = "https://edpsyaschatbot.sdbl-sdb-com.workers.dev/";

// Global variable to store loaded knowledge entries
let knowledge = [];

// 1. Load knowledge.json when the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    
    // Load knowledge base
    loadKnowledge();

    const inputField = document.getElementById('userInput');
    const sendButton = document.querySelector('.input-area button');

    inputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);

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
 * 2. Search knowledge.json across title, keywords, and content
 */
function searchKnowledge(query) {
    if (!knowledge || knowledge.length === 0) return null;

    const lowerQuery = query.toLowerCase();

    // Search for a matching item where title, keywords, or content contains query keywords
    const match = knowledge.find(item => {
        const titleMatch = item.title && item.title.toLowerCase().includes(lowerQuery);
        const contentMatch = item.content && item.content.toLowerCase().includes(lowerQuery);
        
        // Handle keywords array or string format
        let keywordMatch = false;
        if (Array.isArray(item.keywords)) {
            keywordMatch = item.keywords.some(k => k.toLowerCase().includes(lowerQuery));
        } else if (typeof item.keywords === 'string') {
            keywordMatch = item.keywords.toLowerCase().includes(lowerQuery);
        }

        return titleMatch || keywordMatch || contentMatch;
    });

    return match || null;
}

/**
 * Sends the user message with Knowledge Base verification
 */
async function sendMessage() {

    const inputField = document.getElementById('userInput');
    const userText = inputField.value.trim();

    if (userText === "") return;

    renderUserMessage(userText);
    inputField.value = "";
    scrollToBottom();

    // 3. Search knowledge base before calling Gemini
    const matchedItem = searchKnowledge(userText);

    if (!matchedItem) {
        renderBotMessage("Sorry, I couldn't find that topic in the EdPsyAs knowledge base.");
        scrollToBottom();
        return;
    }

    const typingIndicator = showTypingIndicator();

    try {
        // 4. Pass structured prompt context to Gemini
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
 * 4. Formats payload with context/rules and calls Cloudflare Worker
 */
async function fetchGeminiResponse(matchedItem, userPrompt) {

    // Format prompt context strictly using requested rules
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
3. Maximum 150 words.
4. Use headings.
5. Use bullet points.
6. At the end provide the page URL: ${matchedItem.url || "N/A"}`;

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
 * AI Bubble
 */
function renderBotMessage(text) {

    const chatWindow = document.getElementById('chatWindow');

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot-wrapper';

    const avatar = document.createElement('div');
    avatar.className = 'bot-avatar';

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message bot-message';
    messageBubble.textContent = text;

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
    chatWindow.scrollTop = chatWindow.scrollHeight;

}
