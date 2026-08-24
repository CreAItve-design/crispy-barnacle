// Global conversation history array to maintain context
let conversationHistory = [];
let isAwaitingResponse = false;

async function sendMessage() {
    if (isAwaitingResponse) return;

    const inputField = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    if (!inputField || !chatBox) return;

    const message = inputField.value.trim();
    if (!message) return;

    // Lock input state during request
    isAwaitingResponse = true;
    inputField.value = '';
    inputField.disabled = true;

    // Display user message and update history
    appendMessage('You', message, 'user');
    conversationHistory.push({ role: 'user', content: message });

    // Show temporary loading indicator
    const loadingId = appendMessage('Spotlight AI', '...', 'ai');

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        const aiReply = data.reply || 'Thank you for reaching out. How else can we assist you?';

        // Persist AI reply in local state
        conversationHistory.push({ role: 'assistant', content: aiReply });

        // Safely update loading placeholder with the vetted reply
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.innerHTML = '';
            
            const strongTag = document.createElement('strong');
            strongTag.innerText = 'Spotlight AI: ';
            
            const textNode = document.createTextNode(aiReply);
            
            loadingElement.appendChild(strongTag);
            loadingElement.appendChild(textNode);
        }

        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        console.error('Chat error:', error);
        
        // Remove the unanswered user turn so history stays aligned
        conversationHistory.pop();

        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.innerHTML = '<strong>Spotlight AI:</strong> Sorry, our AI estimator is currently offline. Please call us directly!';
        }
    } finally {
        // Unlock input
        isAwaitingResponse = false;
        inputField.disabled = false;
        inputField.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// Safely creates chat elements using text nodes to prevent XSS injection
function appendMessage(sender, text, type) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return null;

    const msgDiv = document.createElement('div');
    const uniqueId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    msgDiv.id = uniqueId;
    msgDiv.className = `message ${type}`;

    const strongTag = document.createElement('strong');
    strongTag.innerText = `${sender}: `;

    const textNode = document.createTextNode(text);

    msgDiv.appendChild(strongTag);
    msgDiv.appendChild(textNode);

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    return uniqueId;
}

// Event Listeners for input submission
document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('user-input');
    const sendButton = document.getElementById('send-btn'); // Matches standard send button ID if present

    if (inputField) {
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }
});


