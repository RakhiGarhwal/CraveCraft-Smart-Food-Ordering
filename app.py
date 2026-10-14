"""
CraveCraft — Smart Food Ordering
Flask Application Backend
"""

import os
import time
import random
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load local environment variables from .env if present
load_dotenv()

from menu_data import MENU_ITEMS, CATEGORIES, MENU_DICT
from bot_engine import chat_with_cravebot, SAMPLE_CONVERSATIONS
from evaluator_engine import evaluate_response, SAMPLE_EVALUATION_REPORT

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

@app.route("/")
def home():
    """Renders the CraveCraft single-page application."""
    return render_template("index.html")


@app.route("/api/menu", methods=["GET"])
def get_menu():
    """Returns the full menu catalog and categories."""
    return jsonify({
        "success": True,
        "categories": CATEGORIES,
        "items": MENU_ITEMS,
        "count": len(MENU_ITEMS)
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Handles CraveBot chat queries.
    Never exposes API keys to client.
    """
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "").strip()
    chat_history = data.get("chat_history", [])

    if not query:
        return jsonify({"success": False, "error": "Query cannot be empty"}), 400

    result = chat_with_cravebot(query, chat_history)
    return jsonify({
        "success": True,
        "query": query,
        **result
    })


@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    """
    Evaluates a chatbot response on Relevance, Menu Factual Consistency, and Clarity.
    Scores 1-5 with detailed feedback and strengths.
    """
    data = request.get_json(force=True, silent=True) or {}
    question = data.get("question", "").strip()
    answer = data.get("answer", "").strip()

    if not question or not answer:
        return jsonify({"success": False, "error": "Both question and answer are required for evaluation"}), 400

    eval_result = evaluate_response(question, answer)
    return jsonify({
        "success": True,
        "evaluation": eval_result
    })


@app.route("/api/sample-evaluation", methods=["GET"])
def sample_evaluation():
    """Returns sample benchmark evaluation report."""
    return jsonify({
        "success": True,
        "report": SAMPLE_EVALUATION_REPORT
    })


@app.route("/api/sample-conversations", methods=["GET"])
def sample_conversations():
    """Returns pre-configured sample prompts for CraveBot."""
    return jsonify({
        "success": True,
        "samples": SAMPLE_CONVERSATIONS
    })


@app.route("/api/status", methods=["GET"])
def api_status():
    """Returns the server configuration status."""
    load_dotenv(override=True)
    has_openai = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()
    return jsonify({
        "success": True,
        "restaurant_name": "CraveCraft — Smart Food Ordering",
        "openai_configured": has_openai,
        "model": model if has_openai else None,
        "bot_engine": f"OpenAI ({model})" if has_openai else "CraveBot Local Heuristic Engine (Demo / Offline Mode)",
        "evaluator_engine": f"OpenAI LLM-as-a-Judge ({model})" if has_openai else "Rule-Based Evaluator (Demo / Offline Mode)"
    })


@app.route("/api/checkout", methods=["POST"])
def checkout():
    """Simulates order submission and returns an order receipt."""
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    if not items:
        return jsonify({"success": False, "error": "Cart is empty"}), 400

    order_id = f"CC-{random.randint(100000, 999999)}"
    eta_mins = random.randint(25, 35)

    subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
    delivery_fee = 0 if subtotal >= 499 else 40
    taxes = round(subtotal * 0.05)
    discount = data.get("discount", 0)
    grand_total = max(0, subtotal + delivery_fee + taxes - discount)

    return jsonify({
        "success": True,
        "order_id": order_id,
        "eta_mins": eta_mins,
        "customer": {
            "name": data.get("name", "Valued Guest"),
            "phone": data.get("phone", "+91 98765 43210"),
            "address": data.get("address", "123 Foodie Blvd, Suite 404")
        },
        "payment_method": data.get("payment_method", "UPI / Google Pay"),
        "totals": {
            "subtotal": subtotal,
            "delivery_fee": delivery_fee,
            "taxes": taxes,
            "discount": discount,
            "grand_total": grand_total
        },
        "items": items,
        "status": "Order Placed & Kitchen Preparing",
        "timestamp": int(time.time())
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[*] Starting CraveCraft Server on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
