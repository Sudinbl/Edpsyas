/* =========================================================
   CHATBOT INTERACTION SCRIPT (script.js)
   Uses Cloudflare Worker instead of exposing Gemini API key
   ========================================================= */

// Your actual Cloudflare Worker URL
const WORKER_URL = "https://edpsyaschatbot.sdbl-sdb-com.workers.dev/";

// Wait for the DOM content to fully load
document.addEventListener('DOMContentLoaded', () => {

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
 * Sends the user message
 */
async function sendMessage() {

    const inputField = document.getElementById('userInput');
    const userText = inputField.value.trim();

    if (userText === "") return;

    renderUserMessage(userText);

    inputField.value = "";

    scrollToBottom();

    const typingIndicator = showTypingIndicator();

    try {

        const botResponse = await fetchGeminiResponse(userText);

        typingIndicator.remove();

        renderBotMessage(botResponse);

    } catch (error) {

        typingIndicator.remove();

        renderBotMessage("⚠️ " + error.message);

    }

    scrollToBottom();

}

/**
 * Calls your Cloudflare Worker
 */
async function fetchGeminiResponse(userPrompt) {

    const response = await fetch(WORKER_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            prompt: userPrompt
        })

    });

    if (!response.ok) {

        const err = await response.text();

        throw new Error(err);

    }

    const data = await response.json();

    const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

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