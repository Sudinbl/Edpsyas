/* =========================================================
   CHATBOT INTERACTION SCRIPT (script.js)
   Supports Small Talk + Knowledge Base (RAG)
   ========================================================= */

// Your Cloudflare Worker URL
const WORKER_URL = "https://edpsyaschatbot.sdbl-sdb-com.workers.dev/";

// Global variable to store loaded knowledge entries
let knowledge = [];

// Helper function to bind listeners reliably
function initChatbot() {
    console.log("Initializing Chatbot listeners...");
    
    // Start loading knowledge base
    loadKnowledge();

    const inputField = document.getElementById('userInput');
    const sendButton = document.getElementById('sendBtn') || document.querySelector('.input-area button');

    if (inputField) {
        inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', (event) => {
            event.preventDefault();
            sendMessage();
        });
        console.log("Send button listener attached successfully.");
    }
}

// Support for both immediate load and DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
} else {
    initChatbot();
}

/**
 * Loads the local knowledge.json file asynchronously
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
 * Checks if the user message is casual greeting or small talk
 */
function isSmallTalk(query) {
    const clean = query.toLowerCase().trim().replace(/[^\w\s]/g, "");
    
    const greetings = [
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", 
        "good evening", "howdy", "sup", "yo", "help", "who are you", 
        "what can you do", "thanks", "thank you", "bye", "goodbye", "ok", "okay"
    ];

    // Check if exact phrase matches list OR if the message is extremely short (1-3 chars)
    return greetings.includes(clean) || (clean.length > 0 && clean.length <= 3);
}

/**
 * Smart Search with weighted scoring for Title, Keywords, and Content
 */
function searchKnowledge(query) {
    if (!knowledge || knowledge.length === 0) return null;

    const cleanQuery = (query || "").toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (!cleanQuery) return null;

    const words = cleanQuery.split(/\s+/);

    const stopWords = [
        "what", "is", "the", "of", "a", "an", "define", "explain",
        "tell", "me", "about", "who", "why", "how", "does", "can", "you", "give"
    ];

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
 * Sends the user message with Small Talk detection & Knowledge Base verification
 */
async function sendMessage() {

    const inputField = document.getElementById('userInput');
    if (!inputField) return;

    const userText = inputField.value.trim();
    if (userText === "") return;

    // Render user bubble immediately
    renderUserMessage(userText);
    inputField.value = "";
    scrollToBottom();

    const typingIndicator = showTypingIndicator();

    try {
        let promptToSend = "";

        // STEP 1: FIRST Check if input is casual small talk (e.g. "hello", "thank you")
        if (isSmallTalk(userText)) {
            promptToSend = `The student is making general small talk or greeting: "${userText}".
Reply in a warm, polite, and conversational manner as the EdPsyAs AI assistant. Briefly offer to help with Educational Psychology topics. Keep it under 2 sentences.`;
        } 
        else {
            // STEP 2: Only search knowledge base if it's NOT small talk
            if (!knowledge || knowledge.length === 0) {
                typingIndicator.remove();
                renderBotMessage("⚠️ Knowledge base is still loading or could not be found. Please refresh the page.");
                scrollToBottom();
                return;
            }

            const matchedItem = searchKnowledge(userText);

            if (!matchedItem) {
                typingIndicator.remove();
                renderBotMessage("Sorry, I couldn't find that topic in the EdPsyAs knowledge base. Please try asking about educational psychology topics!");
                scrollToBottom();
                return;
            }

            // STEP 3: Format structured RAG prompt for academic questions
            promptToSend = `Knowledge Base

Title:
${matchedItem.title}

Content:
${matchedItem.content}

Student Question:
${userText}

Rules:
1. Answer ONLY using the above content.
2. Never use outside knowledge.
3. Keep the response concise, clear, and easy to read (under 150 words).
4. Format key takeaways cleanly using clear bullet points.
5. Provide the source link at the end: ${matchedItem.url || "N/A"}`;
        }

        // Call Cloudflare Worker
        const botResponse = await fetchGeminiResponse(promptToSend);
        typingIndicator.remove();
        renderBotMessage(botResponse);

    } catch (error) {
        typingIndicator.remove();
        renderBotMessage("⚠️ " + error.message);
    }

    scrollToBottom();
}

/**
 * Sends request to Cloudflare Worker
 */
async function fetchGeminiResponse(formattedPrompt) {

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

    const avatar = document.className = 'bot-avatar';

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
