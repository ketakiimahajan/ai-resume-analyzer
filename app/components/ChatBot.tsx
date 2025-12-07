"use client";

import { useState, useRef, useEffect } from "react";
import { usePuterStore } from "../lib/puter";
import { X, Send, MessageCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { ai, auth } = usePuterStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !auth.isAuthenticated) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context
      const systemPrompt = "You are a helpful assistant specializing in resume writing, job search, career advice, and interview preparation. Provide concise, actionable advice.";
      
      const fullPrompt = messages.length > 0
        ? `${systemPrompt}\n\nConversation history:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nUser: ${input.trim()}`
        : `${systemPrompt}\n\nUser: ${input.trim()}`;

      // Try models in order of preference
      const modelsToTry = [
        "gpt-4.1-nano",
        "claude-sonnet-4",
        "claude-3-5-sonnet-20241022",
        "gpt-4o",
        "gpt-4o-mini",
        "google/gemini-2.5-flash",
      ];

      let response: AIResponse | undefined;
      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          console.log(`Trying model: ${model}`);
          
          // Try without options first (use default/free model)
          if (model === "gpt-4.1-nano") {
            response = await ai.chat(fullPrompt);
            console.log("Response:", response);
          } else {
            response = await ai.chat(fullPrompt, { model });
            console.log("Response:", response);
          }

          if (response && !("success" in response && response.success === false)) {
            console.log(`✓ Model ${model} worked!`);
            break;
          }
        } catch (error) {
          console.log(`✗ Model ${model} failed:`, error);
          lastError = error;
        }
      }

      if (!response) {
        console.error("All models failed. Last error:", lastError);
        throw new Error("All AI models are currently unavailable. Please try again in a moment.");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: response.message?.content || "Sorry, I couldn't generate a response.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          "Sorry, I encountered an error. Please try again or rephrase your question.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group animate-bounce-slow"
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <h3 className="font-semibold">Career Assistant</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {!auth.isAuthenticated ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm mb-4">Please sign in to use the Career Assistant</p>
                <button
                  onClick={auth.signIn}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-full hover:shadow-lg transition-all"
                >
                  Sign In with Puter
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">Ask me anything about:</p>
                <ul className="text-xs mt-2 space-y-1">
                  <li>📄 Resume writing tips</li>
                  <li>💼 Job search strategies</li>
                  <li>🎯 Interview preparation</li>
                  <li>📈 Career development</li>
                </ul>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                        : "bg-white text-gray-800 shadow-sm border border-gray-200"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={auth.isAuthenticated ? "Type your question..." : "Please sign in to chat"}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isLoading || !auth.isAuthenticated}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || !auth.isAuthenticated}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full px-4 py-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}