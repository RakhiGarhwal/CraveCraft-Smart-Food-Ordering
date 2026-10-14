"""
CraveBot Conversation & Recommendation Engine
Integrates OpenAI API via OPENAI_API_KEY if configured,
with a robust local NLP heuristic recommendation engine as a reliable fallback.
"""

import os
import re
import json
import requests
from dotenv import load_dotenv
from menu_data import MENU_ITEMS, MENU_DICT, CATEGORIES

# Ensure environment variables are loaded
load_dotenv(override=True)


# Build system prompt grounding the bot in real CraveCraft menu data
MENU_CONTEXT = json.dumps([
    {
        "id": item["id"],
        "name": item["name"],
        "category": item["category_name"],
        "price_inr": item["price"],
        "is_veg": item["is_veg"],
        "spice_level": item["spice_level"],
        "rating": item["rating"],
        "prep_time": item["prep_time"],
        "calories": item["calories"],
        "portion": item["portion"],
        "description": item["description"],
        "taste_profile": item["taste_profile"],
        "ingredients": item["ingredients"],
        "dietary": item["dietary"]
    }
    for item in MENU_ITEMS
], indent=2)

SYSTEM_PROMPT = f"""You are CraveBot, the friendly, charismatic, and knowledgeable AI culinary assistant for "CraveCraft — Smart Food Ordering", a premium modern dining restaurant.

Here is the complete, official, authoritative CraveCraft Menu:
{MENU_CONTEXT}

RULES:
1. Always base menu recommendations and answers strictly on the CraveCraft menu above.
2. Prices are strictly in Indian Rupees (₹). Never invent dishes, prices, or ingredients that are not on this menu.
3. Be warm, enthusiastic, concise, and appetizing in your descriptions.
4. When recommending dishes, always state the exact dish name and price in INR (e.g. "Smoked Butter Chicken Delhi Style (₹489)").
5. If the user specifies a budget (e.g., "under ₹400", "for 2 under ₹800"), calculate the exact total price and ensure the recommendation stays within that budget.
6. Strictly honor dietary preferences (Veg, Non-Veg, High Protein, Mild, Spicy, etc.). Never recommend non-veg to someone asking for vegetarian food.
7. Mention the dish IDs in a machine-readable JSON array at the very end of your response on a new line prefixed with "ITEM_IDS: ", for example:
ITEM_IDS: ["dish-1", "dish-5"]
This allows the frontend to show instant "Add to Cart" buttons.
"""

SAMPLE_CONVERSATIONS = [
    {
        "title": "Budget Dinner for Two",
        "query": "Can you recommend a delicious dinner combo for 2 people under ₹800? We prefer non-veg.",
        "category": "Budget & Pairing"
    },
    {
        "title": "Vegetarian High-Protein",
        "query": "What are your best high-protein vegetarian options? I love smoky flavors.",
        "category": "Dietary Preference"
    },
    {
        "title": "Signature Dish Deep Dive",
        "query": "Tell me about your Dal CraveCraft. What makes it special and what should I pair it with?",
        "category": "Menu Explanation"
    },
    {
        "title": "Spiciest Dishes",
        "query": "I love fiery hot food! What are the spiciest items on the menu?",
        "category": "Taste & Spice"
    }
]


def extract_budget(query: str):
    """Extract numeric budget if present in query like 'under 500', 'under ₹600', 'budget 800'."""
    pattern = r'(?:under|below|within|budget of|less than|max|up to)?\s*(?:rs\.?|inr|₹)?\s*(\d{2,5})'
    match = re.search(pattern, query.lower())
    if match:
        try:
            val = int(match.group(1))
            if 50 <= val <= 10000:
                return val
        except ValueError:
            pass
    return None


def run_local_fallback_bot(query: str, chat_history: list = None) -> dict:
    """
    Intelligent local heuristic NLP engine that understands user intent,
    budget, dietary tags, spice level, ingredients, and item explanations.
    Works 100% offline without any API keys.
    """
    q = query.lower().strip()
    suggested_items = []
    response_lines = []

    # 1. Budget detection
    budget = extract_budget(q)
    wants_veg = "veg" in q and not ("non-veg" in q or "non veg" in q or "chicken" in q or "mutton" in q or "fish" in q)
    wants_nonveg = "non-veg" in q or "non veg" in q or "chicken" in q or "mutton" in q or "meat" in q or "fish" in q
    wants_spicy = any(w in q for w in ["spicy", "hot", "fiery", "teekha", "chilli", "extra spicy"])
    wants_sweet = any(w in q for w in ["sweet", "dessert", "mithai", "chocolate", "gulab jamun"])
    wants_drink = any(w in q for w in ["drink", "beverage", "lassi", "soda", "shikanji", "refresh"])

    # 2. Check for specific dish inquiries
    matched_specific_dish = None
    for item in MENU_ITEMS:
        item_words = item["name"].lower().split()
        if item["name"].lower() in q or (len(item_words) > 1 and f"{item_words[0]} {item_words[1]}" in q):
            matched_specific_dish = item
            break
        elif "butter chicken" in q and item["id"] == "dish-5":
            matched_specific_dish = item
            break
        elif "dal makhani" in q and item["id"] == "dish-6":
            matched_specific_dish = item
            break
        elif "biryani" in q and "chicken" in q and item["id"] == "dish-9":
            matched_specific_dish = item
            break
        elif "biryani" in q and ("veg" in q or "subz" in q) and item["id"] == "dish-10":
            matched_specific_dish = item
            break
        elif "gulab jamun" in q and item["id"] == "dish-12":
            matched_specific_dish = item
            break

    if matched_specific_dish:
        item = matched_specific_dish
        badge = "🟢 Pure Veg" if item["is_veg"] else "🔴 Non-Veg"
        response_lines.append(f"### ✨ **{item['name']}** — ₹{item['price']}")
        response_lines.append(f"**Category:** {item['category_name']} | **Type:** {badge} | **Spice:** {item['spice_level']} 🌶️ | **Rating:** ⭐ {item['rating']}/5")
        response_lines.append(f"\n> *\"{item['description']}\"*")
        response_lines.append(f"\n- **Portion:** {item['portion']}")
        response_lines.append(f"- **Prep Time:** ~{item['prep_time']}")
        response_lines.append(f"- **Calories:** {item['calories']}")
        response_lines.append(f"- **Key Ingredients:** {', '.join(item['ingredients'])}")
        response_lines.append(f"- **Taste Notes:** {item['taste_profile']}")
        
        # Suggested pairing
        if item["category"] in ["mains", "biryani"]:
            pairing = MENU_DICT.get("dish-11") # Naan
            drink = MENU_DICT.get("dish-14") # Mango Lassi
            response_lines.append(f"\n**Chef's Recommended Pairing:** Goes magnificently with **{pairing['name']} (₹{pairing['price']})** and a chilled **{drink['name']} (₹{drink['price']})**!")
            suggested_items.extend([item, pairing, drink])
        else:
            suggested_items.append(item)

        return {
            "reply": "\n".join(response_lines),
            "suggested_items": suggested_items,
            "is_fallback": True,
            "source": "smart_local_engine",
            "model": "CraveBot Local Heuristic Engine (Demo / Offline Mode)"
        }

    # 3. Combo / Meal for 2 inquiry
    if ("for 2" in q or "for two" in q or "combo" in q or "dinner" in q) and budget:
        response_lines.append(f"### 🍽️ Curated Meal for 2 (Budget: ₹{budget})")
        if wants_nonveg:
            # Chicken Biryani (449) + Garlic Naan (149) + Shikanji (119) = 717
            main = MENU_DICT["dish-9"]  # Dum Pukht Chicken Biryani (449)
            starter = MENU_DICT["dish-1"] if budget >= 900 else MENU_DICT["dish-15"] # Shikanji (119)
            side = MENU_DICT["dish-11"]  # Garlic Naan (149)
            dessert = MENU_DICT["dish-12"] if budget >= 900 else None
            
            selected = [main, side, starter] if starter["id"] != "dish-1" else [main, starter, side]
            if dessert and sum(x["price"] for x in selected) + dessert["price"] <= budget:
                selected.append(dessert)
        else:
            # Veg combo: Dal CraveCraft (369) + Garlic Naan (149) + Gulab Jamun (199) = 717
            main = MENU_DICT["dish-6"]  # Dal CraveCraft (369)
            side = MENU_DICT["dish-11"] # Garlic Naan (149)
            treat = MENU_DICT["dish-12"] if (369 + 149 + 199) <= budget else MENU_DICT["dish-15"]
            selected = [main, side, treat]

        total = sum(x["price"] for x in selected)
        for idx, item in enumerate(selected, 1):
            badge = "🟢" if item["is_veg"] else "🔴"
            response_lines.append(f"{idx}. **{item['name']}** {badge} — ₹{item['price']}")
            response_lines.append(f"   *{item['taste_profile']}*")

        response_lines.append(f"\n**Total Combo Price: ₹{total}** (Well within your budget of ₹{budget}!)")
        response_lines.append("Would you like to add these to your order directly?")
        return {
            "reply": "\n".join(response_lines),
            "suggested_items": selected,
            "is_fallback": True,
            "source": "smart_local_engine",
            "model": "CraveBot Local Heuristic Engine (Demo / Offline Mode)"
        }

    # 4. Filter dishes based on criteria
    candidates = list(MENU_ITEMS)
    if wants_veg:
        candidates = [c for c in candidates if c["is_veg"]]
    elif wants_nonveg:
        candidates = [c for c in candidates if not c["is_veg"]]

    if wants_spicy:
        candidates = [c for c in candidates if c["spice_index"] >= 2]
    elif "mild" in q:
        candidates = [c for c in candidates if c["spice_index"] <= 1]

    if wants_sweet:
        candidates = [c for c in candidates if c["category"] == "desserts"]
    elif wants_drink:
        candidates = [c for c in candidates if c["category"] == "beverages"]
    elif "starter" in q or "appetizer" in q:
        candidates = [c for c in candidates if c["category"] == "starters"]
    elif "main" in q or "curry" in q:
        candidates = [c for c in candidates if c["category"] == "mains"]
    elif "biryani" in q or "rice" in q:
        candidates = [c for c in candidates if c["category"] == "biryani"]

    if budget:
        candidates = [c for c in candidates if c["price"] <= budget]

    # Sort by rating and popularity
    candidates.sort(key=lambda x: (x["rating"], x["reviews_count"]), reverse=True)

    if not candidates:
        # Relax constraints
        candidates = [c for c in MENU_ITEMS if (c["price"] <= budget if budget else True)][:3]

    chosen = candidates[:3]
    response_lines.append("### 🌟 CraveBot's Handcrafted Recommendations:")
    if budget:
        response_lines.append(f"*Filtered under ₹{budget}*")
    
    for item in chosen:
        badge = "🟢 Veg" if item["is_veg"] else "🔴 Non-Veg"
        spice = "🌶️" * max(1, item["spice_index"])
        response_lines.append(f"\n- **{item['name']}** ({badge}) — **₹{item['price']}**")
        response_lines.append(f"  ⭐ {item['rating']}/5 | Spice: {item['spice_level']} {spice} | {item['calories']}")
        response_lines.append(f"  _{item['description']}_")

    response_lines.append("\n💡 *Tip: Click any 'Add to Cart' button below to add your favorite directly!*")

    return {
        "reply": "\n".join(response_lines),
        "suggested_items": chosen,
        "is_fallback": True,
        "source": "smart_local_engine",
        "model": "CraveBot Local Heuristic Engine (Demo / Offline Mode)"
    }


def chat_with_cravebot(query: str, chat_history: list = None) -> dict:
    """
    Main entry point for CraveBot. Checks for OPENAI_API_KEY.
    If present, calls OpenAI API. Otherwise gracefully falls back to local NLP engine.
    """
    # Reload environment to ensure dynamically set keys in .env are picked up
    load_dotenv(override=True)
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()

    if not api_key:
        return run_local_fallback_bot(query, chat_history)

    # Format conversation history
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if chat_history and isinstance(chat_history, list):
        for turn in chat_history[-6:]:
            role = "user" if turn.get("sender") == "user" else "assistant"
            messages.append({"role": role, "content": turn.get("text", "")})
    messages.append({"role": "user", "content": query})

    # Try official OpenAI SDK
    try:
        import openai
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        raw_text = ""
        # 1. Primary: Use the OpenAI Responses API
        try:
            # Build conversation input for Responses API
            history_prefix = ""
            if chat_history and isinstance(chat_history, list):
                turns = [f"{'User' if t.get('sender') == 'user' else 'CraveBot'}: {t.get('text', '')}" for t in chat_history[-4:]]
                if turns:
                    history_prefix = "Recent Chat History:\n" + "\n".join(turns) + "\n\n"
            full_input = f"{history_prefix}Customer Question: {query}"

            resp = client.responses.create(
                model=model,
                input=full_input,
                instructions=SYSTEM_PROMPT,
                temperature=0.6,
                max_output_tokens=600
            )
            if hasattr(resp, "output_text") and resp.output_text:
                raw_text = resp.output_text.strip()
            elif hasattr(resp, "output") and resp.output:
                for item in resp.output:
                    if hasattr(item, "content"):
                        for c in item.content:
                            if hasattr(c, "text"):
                                raw_text += c.text
                raw_text = raw_text.strip()
        except Exception:
            # 2. Fallback to Chat Completions API if model or account requires it
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.6,
                max_tokens=600
            )
            raw_text = completion.choices[0].message.content.strip()

        # Parse ITEM_IDS if emitted
        suggested_items = []
        item_match = re.search(r'ITEM_IDS:\s*(\[[^\]]+\])', raw_text)
        clean_text = raw_text
        if item_match:
            try:
                ids = json.loads(item_match.group(1))
                for item_id in ids:
                    if item_id in MENU_DICT:
                        suggested_items.append(MENU_DICT[item_id])
            except Exception:
                pass
            clean_text = raw_text[:item_match.start()].strip()

        # If no explicit IDs, find any mentioned dish names from our ground truth menu
        if not suggested_items:
            for item in MENU_ITEMS:
                if item["name"].lower() in clean_text.lower():
                    if item not in suggested_items:
                        suggested_items.append(item)
            suggested_items = suggested_items[:3]

        return {
            "reply": clean_text,
            "suggested_items": suggested_items,
            "is_fallback": False,
            "source": "openai",
            "model": f"OpenAI ({model})"
        }

    except openai.AuthenticationError:
        fallback = run_local_fallback_bot(query, chat_history)
        fallback["api_notice"] = "Authentication Error: Configured OPENAI_API_KEY is invalid or expired. Switched to local fallback."
        fallback["model"] = "CraveBot Local Heuristic Engine (Demo / Fallback - Invalid Key)"
        return fallback

    except openai.RateLimitError:
        fallback = run_local_fallback_bot(query, chat_history)
        fallback["api_notice"] = "Rate Limit / Quota Error: Insufficient OpenAI API credits or rate limit exceeded. Switched to local fallback."
        fallback["model"] = "CraveBot Local Heuristic Engine (Demo / Fallback - Quota Exceeded)"
        return fallback

    except openai.APIConnectionError:
        fallback = run_local_fallback_bot(query, chat_history)
        fallback["api_notice"] = "Network Connection Error: Could not reach OpenAI API servers. Switched to local fallback."
        fallback["model"] = "CraveBot Local Heuristic Engine (Demo / Fallback - Network Error)"
        return fallback

    except Exception as general_err:
        fallback = run_local_fallback_bot(query, chat_history)
        fallback["api_notice"] = f"OpenAI API error: {str(general_err)[:80]}. Switched to local fallback."
        fallback["model"] = "CraveBot Local Heuristic Engine (Demo / Fallback)"
        return fallback
