"""
Comprehensive Integration & Verification Test Suite for CraveCraft
Tests all requirements:
1. Menu data integrity as authoritative source of truth
2. Demo / Offline fallback mode with clear labels
3. OpenAI Responses API integration for CraveBot
4. OpenAI LLM-as-a-judge API integration for Evaluator
5. Graceful handling of invalid keys, rate limits, and network errors
6. Live key test if OPENAI_API_KEY is configured in .env
"""

import os
import json
from unittest.mock import patch, MagicMock
import openai
from app import app
from bot_engine import chat_with_cravebot
from evaluator_engine import evaluate_response

def run_tests():
    client = app.test_client()

    print("=======================================================")
    print("      CRAVECRAFT API & SYSTEM INTEGRATION TESTS        ")
    print("=======================================================")

    # 1. Test Home page
    r_home = client.get('/')
    assert r_home.status_code == 200, f"Home failed: {r_home.status_code}"
    print("[PASS] 1. GET / returned 200 OK")

    # 2. Test Menu API (Authoritative Source of Truth)
    r_menu = client.get('/api/menu')
    assert r_menu.status_code == 200
    data_menu = json.loads(r_menu.data)
    assert data_menu['success'] is True
    assert data_menu['count'] >= 10, f"Expected >= 10 items, got {data_menu['count']}"
    # Verify vegetarian status flags and INR pricing
    veg_items = [i for i in data_menu['items'] if i['is_veg']]
    nonveg_items = [i for i in data_menu['items'] if not i['is_veg']]
    assert len(veg_items) > 0 and len(nonveg_items) > 0
    print(f"[PASS] 2. GET /api/menu returned {data_menu['count']} items ({len(veg_items)} veg, {len(nonveg_items)} non-veg) as source of truth")

    # 3. Test API Status Endpoint
    r_status = client.get('/api/status')
    assert r_status.status_code == 200
    data_status = json.loads(r_status.data)
    print(f"[PASS] 3. GET /api/status -> openai_configured: {data_status['openai_configured']}, Bot: '{data_status['bot_engine']}'")

    # 4. Test Chatbot Endpoint in Demo/Offline Mode (No API key)
    with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
        r_chat_offline = client.post('/api/chat', json={'query': 'Recommend a dinner for 2 under 800'})
        assert r_chat_offline.status_code == 200
        data_chat_offline = json.loads(r_chat_offline.data)
        assert data_chat_offline['success'] is True
        assert data_chat_offline['is_fallback'] is True
        assert "Demo / Offline Mode" in data_chat_offline['model']
        print(f"[PASS] 4. POST /api/chat (Offline/Demo): Source='{data_chat_offline['source']}', Model='{data_chat_offline['model']}'")

    # 5. Test Evaluate Endpoint in Demo/Offline Mode (Rule-based evaluation)
    with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
        r_eval_offline = client.post('/api/evaluate', json={
            'question': 'What vegetarian starter do you recommend under 400?',
            'answer': 'I recommend our Paneer Tikka Angaara for 349 INR. It is 100% pure vegetarian and charcoal grilled.'
        })
        assert r_eval_offline.status_code == 200
        data_eval_offline = json.loads(r_eval_offline.data)
        assert data_eval_offline['success'] is True
        ev_offline = data_eval_offline['evaluation']
        assert "Rule-Based Evaluator" in ev_offline['evaluator_mode']
        assert "Demo / Offline" in ev_offline['evaluator_mode']
        assert 1.0 <= ev_offline['relevance_score'] <= 5.0
        assert 1.0 <= ev_offline['consistency_score'] <= 5.0
        assert 1.0 <= ev_offline['clarity_score'] <= 5.0
        print(f"[PASS] 5. POST /api/evaluate (Offline/Demo): Mode='{ev_offline['evaluator_mode']}', Scores: Relevance={ev_offline['relevance_score']}, Consistency={ev_offline['consistency_score']}, Clarity={ev_offline['clarity_score']}")

    # 6. Test Chatbot Endpoint with OpenAI Responses API (Mocked Client)
    mock_response_obj = MagicMock()
    mock_response_obj.output_text = "For a feast under ₹800, I recommend our Dum Pukht Chicken Biryani (₹449) and Artisanal Garlic & Herb Naan Basket (₹149). ITEM_IDS: [\"dish-9\", \"dish-11\"]"

    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-mock-valid-key", "OPENAI_MODEL": "gpt-4o-mini"}):
        with patch("openai.OpenAI") as MockOpenAI:
            mock_client = MockOpenAI.return_value
            mock_client.responses.create.return_value = mock_response_obj

            r_chat_openai = client.post('/api/chat', json={'query': 'Dinner for 2 under 800 non-veg'})
            assert r_chat_openai.status_code == 200
            data_chat_openai = json.loads(r_chat_openai.data)
            assert data_chat_openai['success'] is True
            assert data_chat_openai['is_fallback'] is False
            assert data_chat_openai['source'] == 'openai'
            assert data_chat_openai['model'] == 'OpenAI (gpt-4o-mini)'
            assert len(data_chat_openai['suggested_items']) == 2
            # Verify client.responses.create was called
            assert mock_client.responses.create.called
            print(f"[PASS] 6. POST /api/chat (OpenAI Responses API): Called successfully, Model='{data_chat_openai['model']}', Extracted items={len(data_chat_openai['suggested_items'])}")

    # 7. Test Evaluator Endpoint with OpenAI LLM-as-a-Judge (Mocked Client)
    mock_eval_completion = MagicMock()
    mock_eval_choice = MagicMock()
    mock_eval_choice.message.content = json.dumps({
        "relevance_score": 5.0,
        "relevance_feedback": "Accurately addresses budget and portion requirements.",
        "consistency_score": 5.0,
        "consistency_feedback": "Dishes and prices strictly match CraveCraft menu.",
        "clarity_score": 5.0,
        "clarity_feedback": "Clear, appetizing, and informative.",
        "overall_score": 5.0,
        "verdict": "Exceptional",
        "strengths": ["Factual accuracy", "Budget compliance"],
        "improvements": [],
        "verified_dishes": [{"dish": "Dum Pukht Chicken Biryani", "status": "VERIFIED_CORRECT"}]
    })
    mock_eval_completion.choices = [mock_eval_choice]

    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-mock-valid-key", "OPENAI_MODEL": "gpt-4o-mini"}):
        with patch("openai.OpenAI") as MockOpenAI:
            mock_client = MockOpenAI.return_value
            mock_client.chat.completions.create.return_value = mock_eval_completion

            r_eval_openai = client.post('/api/evaluate', json={
                'question': 'Dinner for 2 under 800 non-veg',
                'answer': 'Dum Pukht Chicken Biryani (₹449) + Garlic Naan (₹149)'
            })
            assert r_eval_openai.status_code == 200
            data_eval_openai = json.loads(r_eval_openai.data)
            assert data_eval_openai['success'] is True
            ev_openai = data_eval_openai['evaluation']
            assert ev_openai['evaluator_mode'] == 'OpenAI LLM-as-a-Judge (gpt-4o-mini)'
            assert ev_openai['overall_score'] == 5.0
            print(f"[PASS] 7. POST /api/evaluate (OpenAI LLM-as-a-Judge): Mode='{ev_openai['evaluator_mode']}', Score={ev_openai['overall_score']}/5.0")

    # 8. Test Graceful Error Handling: AuthenticationError (Invalid API Key)
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-invalid-key"}):
        with patch("openai.OpenAI") as MockOpenAI:
            mock_client = MockOpenAI.return_value
            # Simulate AuthenticationError
            mock_client.responses.create.side_effect = openai.AuthenticationError(
                message="Incorrect API key provided",
                response=MagicMock(status_code=401),
                body=None
            )
            r_auth_err = client.post('/api/chat', json={'query': 'What is your best starter?'})
            assert r_auth_err.status_code == 200
            data_auth_err = json.loads(r_auth_err.data)
            assert data_auth_err['is_fallback'] is True
            assert "Invalid Key" in data_auth_err['model'] or "Fallback" in data_auth_err['model']
            print("[PASS] 8. Graceful handling of AuthenticationError (invalid key) -> Fallback to local engine verified")

    # 9. Test Graceful Error Handling: RateLimitError (Quota / Credits Exceeded)
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-quota-exceeded"}):
        with patch("openai.OpenAI") as MockOpenAI:
            mock_client = MockOpenAI.return_value
            mock_client.responses.create.side_effect = openai.RateLimitError(
                message="You exceeded your current quota",
                response=MagicMock(status_code=429),
                body=None
            )
            r_rate_err = client.post('/api/chat', json={'query': 'What is your best starter?'})
            assert r_rate_err.status_code == 200
            data_rate_err = json.loads(r_rate_err.data)
            assert data_rate_err['is_fallback'] is True
            assert "Quota Exceeded" in data_rate_err['model'] or "Fallback" in data_rate_err['model']
            print("[PASS] 9. Graceful handling of RateLimitError (missing credits/quota) -> Fallback to local engine verified")

    # 10. Test Graceful Error Handling: APIConnectionError (Network Timeout / Failure)
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-network-fail"}):
        with patch("openai.OpenAI") as MockOpenAI:
            mock_client = MockOpenAI.return_value
            mock_client.responses.create.side_effect = openai.APIConnectionError(
                message="Connection timeout",
                request=MagicMock()
            )
            r_conn_err = client.post('/api/chat', json={'query': 'What is your best starter?'})
            assert r_conn_err.status_code == 200
            data_conn_err = json.loads(r_conn_err.data)
            assert data_conn_err['is_fallback'] is True
            assert "Network Error" in data_conn_err['model'] or "Fallback" in data_conn_err['model']
            print("[PASS] 10. Graceful handling of APIConnectionError (network failure) -> Fallback to local engine verified")

    # 11. Check for real live key in .env or environment
    real_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if real_key and not real_key.startswith("sk-mock") and not real_key.startswith("sk-test"):
        print("\n--- Live OPENAI_API_KEY detected in .env/environment ---")
        try:
            live_chat = chat_with_cravebot("Recommend 1 signature veg starter under 400")
            print(f"[LIVE TEST] Chatbot Response ({live_chat.get('model')}): {live_chat.get('reply')[:70]}...")
            live_eval = evaluate_response("Recommend 1 signature veg starter under 400", live_chat.get('reply', ''))
            print(f"[LIVE TEST] Evaluator Response ({live_eval.get('evaluator_mode')}): Score {live_eval.get('overall_score')}/5.0 ({live_eval.get('verdict')})")
        except Exception as e:
            print(f"[LIVE TEST WARNING] Live test returned exception: {e}")
    else:
        print("[INFO] No real live OPENAI_API_KEY was inserted into .env yet. Demo / Offline mode is active and verified.")

    print("\n=======================================================")
    print("ALL 10 VERIFICATION & INTEGRATION TESTS PASSED 100%!")
    print("=======================================================")

if __name__ == '__main__':
    run_tests()
