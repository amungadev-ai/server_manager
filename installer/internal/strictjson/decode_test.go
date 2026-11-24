package strictjson

import "testing"

func TestRejectsAmbiguousAndUnboundedJSON(t *testing.T) {
	type object struct {
		Value string `json:"value"`
	}
	var good object
	if Decode([]byte(`{"value":"ok"}`), &good, 100) != nil || good.Value != "ok" {
		t.Fatal("valid object rejected")
	}
	for _, s := range []string{`{"value":"a","value":"b"}`, `{"value":"a","\u0076alue":"b"}`, `{"value":null}`, `{"unknown":"a"}`, `{"value":"a"} {}`, `{"value":{"x":1,"x":2}}`, `{"value":`, string([]byte{255}), `[[[[[[[[[[0]]]]]]]]]]`} {
		t.Run(s, func(t *testing.T) {
			var v object
			if Decode([]byte(s), &v, 100) == nil {
				t.Fatal("ambiguous input accepted")
			}
		})
	}
	if Decode([]byte(`{"value":"ok"}`), &good, 4) == nil {
		t.Fatal("bound ignored")
	}
}
