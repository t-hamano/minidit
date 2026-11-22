//! Converting between file bytes and editor text: encodings and line
//! endings.
//!
//! The editor always holds text with LF line endings. A file's encoding and
//! line ending are detected when it is read and restored when it is saved.

use encoding_rs::{SHIFT_JIS, UTF_16BE, UTF_16LE};
use serde::{Deserialize, Serialize};

const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];
const UTF16LE_BOM: &[u8] = &[0xFF, 0xFE];
const UTF16BE_BOM: &[u8] = &[0xFE, 0xFF];

/// The names are spelled out because the frontend sends and receives them
/// as strings. They must match `ENCODINGS` in `src/files/text-format.ts`,
/// which a test below checks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Encoding {
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-8-bom")]
    Utf8Bom,
    #[serde(rename = "utf-16-le")]
    Utf16Le,
    #[serde(rename = "utf-16-be")]
    Utf16Be,
    /// Windows-31J, which `encoding_rs` calls Shift_JIS.
    #[serde(rename = "shift-jis")]
    ShiftJis,
}

impl Encoding {
    #[cfg(test)]
    pub const ALL: [Self; 5] = [
        Self::Utf8,
        Self::Utf8Bom,
        Self::Utf16Le,
        Self::Utf16Be,
        Self::ShiftJis,
    ];
}

/// The names must match `LINE_ENDINGS` in `src/files/text-format.ts`,
/// which a test below checks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum LineEnding {
    #[serde(rename = "crlf")]
    Crlf,
    #[serde(rename = "lf")]
    Lf,
}

impl LineEnding {
    #[cfg(test)]
    pub const ALL: [Self; 2] = [Self::Crlf, Self::Lf];

    pub const fn os_default() -> Self {
        if cfg!(windows) {
            Self::Crlf
        } else {
            Self::Lf
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct Decoded {
    /// The text with LF line endings.
    pub text: String,
    pub encoding: Encoding,
    pub line_ending: LineEnding,
    /// Whether some bytes could not be decoded and were replaced with
    /// U+FFFD.
    pub had_errors: bool,
}

/// Detects the encoding: a BOM wins, then valid UTF-8, then Shift_JIS.
pub fn detect_encoding(bytes: &[u8]) -> Encoding {
    if bytes.starts_with(UTF8_BOM) {
        Encoding::Utf8Bom
    } else if bytes.starts_with(UTF16LE_BOM) {
        Encoding::Utf16Le
    } else if bytes.starts_with(UTF16BE_BOM) {
        Encoding::Utf16Be
    } else if std::str::from_utf8(bytes).is_ok() {
        Encoding::Utf8
    } else {
        Encoding::ShiftJis
    }
}

/// Decodes file bytes, detecting the encoding unless one is given.
pub fn decode(bytes: &[u8], encoding: Option<Encoding>) -> Decoded {
    let encoding = encoding.unwrap_or_else(|| detect_encoding(bytes));
    let (text, had_errors) = match encoding {
        Encoding::Utf8 | Encoding::Utf8Bom => {
            let body = bytes.strip_prefix(UTF8_BOM).unwrap_or(bytes);
            match String::from_utf8_lossy(body) {
                std::borrow::Cow::Borrowed(text) => (text.to_owned(), false),
                std::borrow::Cow::Owned(text) => (text, true),
            }
        }
        Encoding::Utf16Le => {
            let body = bytes.strip_prefix(UTF16LE_BOM).unwrap_or(bytes);
            let (text, had_errors) = UTF_16LE.decode_without_bom_handling(body);
            (text.into_owned(), had_errors)
        }
        Encoding::Utf16Be => {
            let body = bytes.strip_prefix(UTF16BE_BOM).unwrap_or(bytes);
            let (text, had_errors) = UTF_16BE.decode_without_bom_handling(body);
            (text.into_owned(), had_errors)
        }
        Encoding::ShiftJis => {
            let (text, had_errors) = SHIFT_JIS.decode_without_bom_handling(bytes);
            (text.into_owned(), had_errors)
        }
    };
    let line_ending = detect_line_ending(&text);
    Decoded {
        text: normalize_line_endings(&text),
        encoding,
        line_ending,
        had_errors,
    }
}

/// Uses whichever of CRLF and LF appears more often, or the OS default when
/// they tie or there are no line breaks.
pub fn detect_line_ending(text: &str) -> LineEnding {
    let crlf = text.matches("\r\n").count();
    let lf = text.matches('\n').count() - crlf;
    match crlf.cmp(&lf) {
        std::cmp::Ordering::Greater => LineEnding::Crlf,
        std::cmp::Ordering::Less => LineEnding::Lf,
        std::cmp::Ordering::Equal => LineEnding::os_default(),
    }
}

/// Converts CRLF and lone CR line endings to LF.
pub fn normalize_line_endings(text: &str) -> String {
    if !text.contains('\r') {
        return text.to_owned();
    }
    text.replace("\r\n", "\n").replace('\r', "\n")
}

#[derive(Debug, PartialEq, Eq)]
pub struct Unrepresentable;

/// Encodes editor text for saving.
///
/// Fails when the text has characters that the encoding cannot represent.
pub fn encode(
    text: &str,
    encoding: Encoding,
    line_ending: LineEnding,
) -> Result<Vec<u8>, Unrepresentable> {
    let normalized = normalize_line_endings(text);
    let text = match line_ending {
        LineEnding::Lf => normalized,
        LineEnding::Crlf => normalized.replace('\n', "\r\n"),
    };
    Ok(match encoding {
        Encoding::Utf8 => text.into_bytes(),
        Encoding::Utf8Bom => [UTF8_BOM, text.as_bytes()].concat(),
        Encoding::Utf16Le => UTF16LE_BOM
            .iter()
            .copied()
            .chain(text.encode_utf16().flat_map(u16::to_le_bytes))
            .collect(),
        Encoding::Utf16Be => UTF16BE_BOM
            .iter()
            .copied()
            .chain(text.encode_utf16().flat_map(u16::to_be_bytes))
            .collect(),
        Encoding::ShiftJis => {
            let (bytes, _, had_errors) = SHIFT_JIS.encode(&text);
            if had_errors {
                return Err(Unrepresentable);
            }
            bytes.into_owned()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sjis(text: &str) -> Vec<u8> {
        SHIFT_JIS.encode(text).0.into_owned()
    }

    /// The frontend's list of names, such as `ENCODINGS`.
    fn frontend_names(list: &str) -> Vec<String> {
        let source = include_str!("../../src/files/text-format.ts");
        let start = source
            .find(&format!("export const {list}"))
            .unwrap_or_else(|| panic!("{list} is missing from text-format.ts"));
        let rest = &source[start..];
        let body = &rest[rest.find('[').unwrap()..rest.find("];").unwrap()];
        body.split('\'')
            .skip(1)
            .step_by(2)
            .map(String::from)
            .collect()
    }

    fn names<T: Serialize>(values: &[T]) -> Vec<String> {
        values
            .iter()
            .map(|value| {
                serde_json::to_value(value)
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .to_owned()
            })
            .collect()
    }

    #[test]
    fn matches_the_frontend_names() {
        assert_eq!(names(&Encoding::ALL), frontend_names("ENCODINGS"));
        assert_eq!(names(&LineEnding::ALL), frontend_names("LINE_ENDINGS"));
    }

    #[test]
    fn accepts_the_new_file_format() {
        // A new tab is saved as UTF-8 with the OS's line ending.
        let encoding: Encoding = serde_json::from_str("\"utf-8\"").unwrap();
        assert_eq!(encoding, Encoding::Utf8);
        let line_ending: LineEnding = serde_json::from_str("\"crlf\"").unwrap();
        assert_eq!(line_ending, LineEnding::Crlf);
    }

    #[test]
    fn detects_encodings() {
        assert_eq!(detect_encoding(b"\xEF\xBB\xBFabc"), Encoding::Utf8Bom);
        assert_eq!(detect_encoding(b"\xFF\xFEa\0"), Encoding::Utf16Le);
        assert_eq!(detect_encoding(b"\xFE\xFF\0a"), Encoding::Utf16Be);
        assert_eq!(detect_encoding("日本語".as_bytes()), Encoding::Utf8);
        assert_eq!(detect_encoding(b""), Encoding::Utf8);
        assert_eq!(detect_encoding(&sjis("日本語")), Encoding::ShiftJis);
    }

    #[test]
    fn decodes_shift_jis() {
        let decoded = decode(&sjis("メモ\r\n①"), None);
        assert_eq!(decoded.text, "メモ\n①");
        assert_eq!(decoded.encoding, Encoding::ShiftJis);
        assert_eq!(decoded.line_ending, LineEnding::Crlf);
        assert!(!decoded.had_errors);
    }

    #[test]
    fn replaces_undecodable_shift_jis_bytes() {
        let decoded = decode(b"a\x81\x20b\xA0", None);
        assert_eq!(decoded.encoding, Encoding::ShiftJis);
        assert!(decoded.had_errors);
        assert!(decoded.text.contains('\u{FFFD}'));
    }

    #[test]
    fn decodes_with_a_chosen_encoding() {
        let decoded = decode("日本語".as_bytes(), Some(Encoding::ShiftJis));
        assert_eq!(decoded.encoding, Encoding::ShiftJis);
        assert_ne!(decoded.text, "日本語");
        let decoded = decode(b"\xEF\xBB\xBFabc", Some(Encoding::Utf8));
        assert_eq!(decoded.text, "abc");
    }

    #[test]
    fn detects_line_endings_by_majority() {
        assert_eq!(detect_line_ending("a\r\nb\r\nc\n"), LineEnding::Crlf);
        assert_eq!(detect_line_ending("a\nb\nc\r\n"), LineEnding::Lf);
        assert_eq!(detect_line_ending("a\r\nb\n"), LineEnding::os_default());
        assert_eq!(detect_line_ending("abc"), LineEnding::os_default());
    }

    #[test]
    fn normalizes_cr_only_line_endings_to_lf() {
        assert_eq!(normalize_line_endings("a\rb\r\nc\n"), "a\nb\nc\n");
    }

    #[test]
    fn round_trips_every_encoding() {
        let text = "日本語\nline 2\n";
        for encoding in Encoding::ALL {
            for line_ending in LineEnding::ALL {
                let bytes = encode(text, encoding, line_ending).unwrap();
                let decoded = decode(&bytes, None);
                assert_eq!(decoded.text, text, "{encoding:?} {line_ending:?}");
                assert_eq!(decoded.encoding, encoding);
                assert_eq!(decoded.line_ending, line_ending);
            }
        }
    }

    #[test]
    fn unifies_mixed_line_endings_on_save() {
        let bytes = encode("a\r\nb\nc", Encoding::Utf8, LineEnding::Crlf).unwrap();
        assert_eq!(bytes, b"a\r\nb\r\nc");
    }

    #[test]
    fn refuses_characters_shift_jis_cannot_represent() {
        assert_eq!(
            encode("emoji 😀", Encoding::ShiftJis, LineEnding::Lf),
            Err(Unrepresentable)
        );
    }
}
