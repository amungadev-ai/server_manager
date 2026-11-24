package strictjson

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"unicode/utf8"
)

var ErrFormat = errors.New("invalid_json")

// Decode rejects duplicate names at every depth, unknown fields, nulls and tails.
func Decode(data []byte, dst any, limit int) error {
	if len(data) == 0 || len(data) > limit || !utf8.Valid(data) {
		return ErrFormat
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.UseNumber()
	var walk func(int) error
	walk = func(depth int) error {
		if depth > 8 {
			return ErrFormat
		}
		token, err := d.Token()
		if err != nil || token == nil {
			return ErrFormat
		}
		switch token {
		case json.Delim('{'):
			seen := map[string]bool{}
			for d.More() {
				t, err := d.Token()
				k, ok := t.(string)
				if err != nil || !ok || seen[k] {
					return ErrFormat
				}
				seen[k] = true
				if err := walk(depth + 1); err != nil {
					return err
				}
			}
			t, err := d.Token()
			if err != nil || t != json.Delim('}') {
				return ErrFormat
			}
		case json.Delim('['):
			for d.More() {
				if err := walk(depth + 1); err != nil {
					return err
				}
			}
			t, err := d.Token()
			if err != nil || t != json.Delim(']') {
				return ErrFormat
			}
		default:
			if _, ok := token.(json.Delim); ok {
				return ErrFormat
			}
		}
		return nil
	}
	if err := walk(0); err != nil {
		return err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return ErrFormat
	}
	d = json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(dst); err != nil {
		return ErrFormat
	}
	return nil
}
