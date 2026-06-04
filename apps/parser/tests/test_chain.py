from trender.llm.chain import _pick_model


def test_report_role_always_uses_default_model():
    assert _pick_model("report", "light-model", "default-model") == "default-model"
    assert _pick_model("report", None, "default-model") == "default-model"
    assert _pick_model("report", "", "default-model") == "default-model"


def test_light_role_uses_light_model_when_set():
    assert _pick_model("light", "light-model", "default-model") == "light-model"


def test_light_role_falls_back_to_default_when_light_missing():
    assert _pick_model("light", None, "default-model") == "default-model"
    assert _pick_model("light", "", "default-model") == "default-model"
