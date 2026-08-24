// Global conversation history array to give the AI memory
let conversationHistory = [];

async function sendMessage() {
    const inputField = document.getElementById('user-input');
    const message = inputField.value.trim();
    if (!message) return;

    // Display user message and push to local history array
    appendMessage('You', message, 'user');
    conversationHistory.push({ role: "user", content: message });
    inputField.value = '';

    // Show temporary loading state for the AI response
    const loadingId = appendMessage('Spotlight AI', '...', 'ai');

    try {
        // Send the entire conversation history to your Netlify serverless function
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        const aiReply = data.reply;
        
        // Save the AI's response to the history array so memory persists
        conversationHistory.push({ role: "assistant", content: aiReply });
        
        // Safely replace the loading dots with the real, vetted AI response
        const chatBox = document.getElementById('chat-box');
        const loadingElement = document.getElementById(loadingId);
        
        // Clear out loading dots
        loadingElement.innerHTML = '';
        
        // Re-insert the strong tag for the name
        const strongTag = document.createElement('strong');
        strongTag.innerText = 'Spotlight AI: ';
        loadingElement.appendChild(strongTag);
        
        // Safely append the response text as a text node to prevent XSS attacks
        const textNode = document.createTextNode(aiReply);
        loadingElement.appendChild(textNode);
        
        // Smoothly auto-scroll to the bottom of the chat
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        console.error("Chat error:", error);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.innerHTML = `<strong>Spotlight AI:</strong> Sorry, our AI estimator is currently offline. Please call us directly!`;
        }
    }
}

// Securely creates chat bubbles using text nodes instead of innerHTML to prevent script injections
function appendMessage(sender, text, type) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    const uniqueId = 'msg-' + Date.now() + Math.random().toString(36).substr(2, 5);
    
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

// Allows users to submit their message using the "Enter" key alongside the click button
document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('user-input');
    if (inputField) {
        inputField.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});



