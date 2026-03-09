use crate::models::TranslateDescriptionResponse;
use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::env;
use std::time::Duration;

pub const ERR_TRANSLATION_NOT_CONFIGURED: &str = "TranslationNotConfigured";
pub const ERR_TRANSLATION_PROVIDER_FAILED: &str = "TranslationProviderFailed";
pub const ERR_TRANSLATION_INVALID_RESPONSE: &str = "TranslationInvalidResponse";
pub const ERR_TRANSLATION_INVALID_ARGUMENT: &str = "InvalidArgument";

const ENV_LIBRETRANSLATE_URL: &str = "LIBRETRANSLATE_URL";
const ENV_LIBRETRANSLATE_API_KEY: &str = "LIBRETRANSLATE_API_KEY";
const ENV_OPENAI_API_KEY: &str = "OPENAI_API_KEY";
const ENV_TRANSLATION_MODEL: &str = "OPENAI_TRANSLATION_MODEL";
const ENV_TRANSLATION_TIMEOUT_MS: &str = "OPENAI_TRANSLATION_TIMEOUT_MS";
const OPENAI_RESPONSES_API_URL: &str = "https://api.openai.com/v1/responses";
const DEFAULT_TRANSLATION_MODEL: &str = "gpt-4.1-mini";
pub const DEFAULT_TARGET_LANGUAGE: &str = "zh-CN";
const DEFAULT_TIMEOUT_MS: u64 = 15_000;
const MAX_DETAIL_CHARS: usize = 1_000;
const PROVIDER_LIBRETRANSLATE: &str = "libretranslate";
const PROVIDER_OPENAI: &str = "openai";
const DEFAULT_PUBLIC_LIBRETRANSLATE_URLS: &[&str] = &["https://translate.cutie.dating"];
const DEFAULT_PUBLIC_LIBRETRANSLATE_MODEL: &str = "community-mirror";

#[derive(Debug, Clone)]
pub struct TranslationError {
    pub code: &'static str,
    pub message: String,
    pub details: Option<String>,
}

impl TranslationError {
    fn new(code: &'static str, message: impl Into<String>, details: Option<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details,
        }
    }
}

pub type TranslationResult<T> = Result<T, TranslationError>;

#[derive(Debug, Clone)]
struct TranslationConfig {
    providers: Vec<ProviderConfig>,
    timeout_ms: u64,
}

#[derive(Debug, Clone)]
enum ProviderConfig {
    LibreTranslate {
        url: String,
        api_key: Option<String>,
        model: String,
    },
    OpenAi {
        api_key: String,
        model: String,
    },
}

impl ProviderConfig {
    fn provider_name(&self) -> &'static str {
        match self {
            Self::LibreTranslate { .. } => PROVIDER_LIBRETRANSLATE,
            Self::OpenAi { .. } => PROVIDER_OPENAI,
        }
    }

    #[cfg(test)]
    fn kind(&self) -> &'static str {
        self.provider_name()
    }
}

#[derive(Debug, Deserialize)]
struct ResponsesApiResponse {
    #[serde(default)]
    output: Vec<ResponsesApiOutputItem>,
}

#[derive(Debug, Deserialize)]
struct ResponsesApiOutputItem {
    #[serde(rename = "type")]
    item_type: String,
    #[serde(default)]
    content: Vec<ResponsesApiContentItem>,
}

#[derive(Debug, Deserialize)]
struct ResponsesApiContentItem {
    #[serde(rename = "type")]
    item_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LibreTranslateResponse {
    #[serde(rename = "translatedText")]
    translated_text: Option<String>,
}

impl TranslationConfig {
    fn from_env() -> TranslationResult<Self> {
        let timeout_ms = env_var_trimmed(ENV_TRANSLATION_TIMEOUT_MS)
            .map(|value| parse_timeout_ms(&value))
            .transpose()?
            .unwrap_or(DEFAULT_TIMEOUT_MS);

        let providers = if let Some(url) = env_var_trimmed(ENV_LIBRETRANSLATE_URL) {
            vec![build_libretranslate_provider(
                &url,
                env_var_trimmed(ENV_LIBRETRANSLATE_API_KEY),
                "custom".to_string(),
            )?]
        } else {
            let mut default_providers = default_public_libretranslate_providers();
            if let Some(api_key) = env_var_trimmed(ENV_OPENAI_API_KEY) {
                let model = env_var_trimmed(ENV_TRANSLATION_MODEL)
                    .unwrap_or_else(|| DEFAULT_TRANSLATION_MODEL.to_string());
                default_providers.push(ProviderConfig::OpenAi { api_key, model });
            }
            default_providers
        };

        if providers.is_empty() {
            return Err(TranslationError::new(
                ERR_TRANSLATION_NOT_CONFIGURED,
                format!("未配置可用翻译服务，请检查 {ENV_LIBRETRANSLATE_URL} 或内置免费镜像配置"),
                None,
            ));
        }

        Ok(Self {
            providers,
            timeout_ms,
        })
    }
}

pub struct TranslationService;

impl TranslationService {
    pub fn translate_description(
        description: &str,
        target_language: Option<&str>,
    ) -> TranslationResult<TranslateDescriptionResponse> {
        let description = description.trim();
        if description.is_empty() {
            return Err(TranslationError::new(
                ERR_TRANSLATION_INVALID_ARGUMENT,
                "description 不能为空",
                None,
            ));
        }

        let config = TranslationConfig::from_env()?;
        let mut errors = Vec::with_capacity(config.providers.len());

        for provider in &config.providers {
            let outcome = match provider {
                ProviderConfig::LibreTranslate {
                    url,
                    api_key,
                    model,
                } => translate_with_libretranslate(
                    description,
                    normalize_target_language_for_provider(
                        target_language,
                        PROVIDER_LIBRETRANSLATE,
                    )
                    .as_deref(),
                    url,
                    api_key.as_deref(),
                    model,
                    config.timeout_ms,
                ),
                ProviderConfig::OpenAi { api_key, model } => translate_with_openai(
                    description,
                    normalize_target_language_for_provider(target_language, PROVIDER_OPENAI)
                        .as_deref(),
                    api_key,
                    model,
                    config.timeout_ms,
                ),
            };

            match outcome {
                Ok(response) => return Ok(response),
                Err(error) => errors.push(format_provider_error(provider, &error)),
            }
        }

        Err(TranslationError::new(
            ERR_TRANSLATION_PROVIDER_FAILED,
            "所有增强翻译提供方均不可用",
            Some(truncate_detail(&errors.join("\n---\n"))),
        ))
    }
}

fn build_libretranslate_provider(
    url: &str,
    api_key: Option<String>,
    model: String,
) -> TranslationResult<ProviderConfig> {
    let normalized_url = normalize_libretranslate_url(url).ok_or_else(|| {
        TranslationError::new(
            ERR_TRANSLATION_INVALID_ARGUMENT,
            format!("{ENV_LIBRETRANSLATE_URL} 不能为空"),
            None,
        )
    })?;

    Ok(ProviderConfig::LibreTranslate {
        url: normalized_url,
        api_key,
        model,
    })
}

fn default_public_libretranslate_providers() -> Vec<ProviderConfig> {
    DEFAULT_PUBLIC_LIBRETRANSLATE_URLS
        .iter()
        .filter_map(|url| {
            build_libretranslate_provider(
                url,
                None,
                DEFAULT_PUBLIC_LIBRETRANSLATE_MODEL.to_string(),
            )
            .ok()
        })
        .collect()
}

fn format_provider_error(provider: &ProviderConfig, error: &TranslationError) -> String {
    let detail = error.details.as_deref().unwrap_or("无详情");
    format!(
        "provider={} message={} details={detail}",
        provider.provider_name(),
        error.message,
    )
}

fn translate_with_libretranslate(
    description: &str,
    target_language: Option<&str>,
    url: &str,
    api_key: Option<&str>,
    model: &str,
    timeout_ms: u64,
) -> TranslationResult<TranslateDescriptionResponse> {
    let client = build_http_client(timeout_ms)?;
    let mut request_body = json!({
        "q": description,
        "source": "auto",
        "target": target_language.unwrap_or("zh"),
        "format": "text",
    });

    if let Some(value) = api_key.filter(|value| !value.trim().is_empty()) {
        request_body["api_key"] = Value::String(value.to_string());
    }

    let response = client.post(url).json(&request_body).send().map_err(|err| {
        TranslationError::new(
            ERR_TRANSLATION_PROVIDER_FAILED,
            request_error_message("免费翻译服务", &err),
            Some(truncate_detail(&err.to_string())),
        )
    })?;

    let status = response.status();
    let response_body = response.text().map_err(|err| {
        TranslationError::new(
            ERR_TRANSLATION_PROVIDER_FAILED,
            "读取免费翻译响应失败",
            Some(truncate_detail(&err.to_string())),
        )
    })?;

    if !status.is_success() {
        let details = response_body.trim();
        return Err(TranslationError::new(
            ERR_TRANSLATION_PROVIDER_FAILED,
            format!("免费翻译返回 HTTP {}", status.as_u16()),
            (!details.is_empty()).then(|| truncate_detail(details)),
        ));
    }

    let response: LibreTranslateResponse =
        serde_json::from_str(response_body.trim()).map_err(|err| {
            TranslationError::new(
                ERR_TRANSLATION_INVALID_RESPONSE,
                "免费翻译响应解析失败",
                Some(err.to_string()),
            )
        })?;

    let translation = response
        .translated_text
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            TranslationError::new(
                ERR_TRANSLATION_INVALID_RESPONSE,
                "免费翻译响应中缺少可用文本",
                None,
            )
        })?;

    Ok(TranslateDescriptionResponse {
        translation,
        provider: PROVIDER_LIBRETRANSLATE.to_string(),
        model: model.to_string(),
    })
}

fn translate_with_openai(
    description: &str,
    target_language: Option<&str>,
    api_key: &str,
    model: &str,
    timeout_ms: u64,
) -> TranslationResult<TranslateDescriptionResponse> {
    let client = build_http_client(timeout_ms)?;
    let request_body = json!({
        "model": model,
        "instructions": build_translation_instructions(target_language),
        "input": description,
        "store": false,
    });

    let response = client
        .post(OPENAI_RESPONSES_API_URL)
        .bearer_auth(api_key)
        .json(&request_body)
        .send()
        .map_err(|err| {
            TranslationError::new(
                ERR_TRANSLATION_PROVIDER_FAILED,
                request_error_message("增强翻译服务", &err),
                Some(truncate_detail(&err.to_string())),
            )
        })?;

    let status = response.status();
    let response_body = response.text().map_err(|err| {
        TranslationError::new(
            ERR_TRANSLATION_PROVIDER_FAILED,
            "读取增强翻译响应失败",
            Some(truncate_detail(&err.to_string())),
        )
    })?;

    if !status.is_success() {
        let details = response_body.trim();
        return Err(TranslationError::new(
            ERR_TRANSLATION_PROVIDER_FAILED,
            format!("增强翻译返回 HTTP {}", status.as_u16()),
            (!details.is_empty()).then(|| truncate_detail(details)),
        ));
    }

    let response: ResponsesApiResponse =
        serde_json::from_str(response_body.trim()).map_err(|err| {
            TranslationError::new(
                ERR_TRANSLATION_INVALID_RESPONSE,
                "增强翻译响应解析失败",
                Some(err.to_string()),
            )
        })?;

    let translation = extract_output_text(&response).ok_or_else(|| {
        TranslationError::new(
            ERR_TRANSLATION_INVALID_RESPONSE,
            "增强翻译响应中缺少可用文本",
            None,
        )
    })?;

    Ok(TranslateDescriptionResponse {
        translation,
        provider: PROVIDER_OPENAI.to_string(),
        model: model.to_string(),
    })
}

fn build_http_client(timeout_ms: u64) -> TranslationResult<Client> {
    Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|err| {
            TranslationError::new(
                ERR_TRANSLATION_PROVIDER_FAILED,
                "初始化翻译客户端失败",
                Some(err.to_string()),
            )
        })
}

fn request_error_message(provider_label: &str, error: &reqwest::Error) -> String {
    if error.is_timeout() {
        format!("{provider_label}请求超时")
    } else if error.is_connect() {
        format!("连接{provider_label}失败")
    } else if error.is_request() {
        format!("构造{provider_label}请求失败")
    } else {
        format!("{provider_label}请求失败")
    }
}

fn env_var_trimmed(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_libretranslate_url(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.ends_with("/translate") {
        Some(trimmed.to_string())
    } else {
        Some(format!("{trimmed}/translate"))
    }
}

fn normalize_target_language(target_language: Option<&str>) -> Option<String> {
    target_language
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn normalize_target_language_for_provider(
    target_language: Option<&str>,
    provider_kind: &str,
) -> Option<String> {
    let normalized = normalize_target_language(target_language);

    if provider_kind == PROVIDER_LIBRETRANSLATE {
        return normalized.map(|value| {
            if value.eq_ignore_ascii_case("zh")
                || value.eq_ignore_ascii_case("zh-CN")
                || value.eq_ignore_ascii_case("zh-TW")
            {
                "zh".to_string()
            } else {
                value
            }
        });
    }

    normalized
}

fn build_translation_instructions(target_language: Option<&str>) -> String {
    let resolved_target_language = target_language.unwrap_or(DEFAULT_TARGET_LANGUAGE);
    let human_language = human_readable_target_language(resolved_target_language);

    format!(
        "Translate the user-provided skill or plugin description faithfully and completely into natural {human_language} for a product UI. Do not summarize, shorten, omit, add, or reinterpret information. Preserve product names, file paths, commands, code identifiers, Markdown formatting, and technical terms when appropriate. Return only the translated text in {human_language}."
    )
}

fn human_readable_target_language(target_language: &str) -> &str {
    if target_language.eq_ignore_ascii_case("zh") || target_language.eq_ignore_ascii_case("zh-CN") {
        "Simplified Chinese (zh-CN)"
    } else {
        target_language
    }
}

fn parse_timeout_ms(value: &str) -> TranslationResult<u64> {
    let timeout_ms = value.parse::<u64>().map_err(|_| {
        TranslationError::new(
            ERR_TRANSLATION_INVALID_ARGUMENT,
            format!("{ENV_TRANSLATION_TIMEOUT_MS} 必须是正整数"),
            Some(value.to_string()),
        )
    })?;

    if timeout_ms == 0 {
        return Err(TranslationError::new(
            ERR_TRANSLATION_INVALID_ARGUMENT,
            format!("{ENV_TRANSLATION_TIMEOUT_MS} 必须大于 0"),
            Some(value.to_string()),
        ));
    }

    Ok(timeout_ms)
}

fn extract_output_text(response: &ResponsesApiResponse) -> Option<String> {
    let segments = response
        .output
        .iter()
        .filter(|item| item.item_type == "message")
        .flat_map(|item| item.content.iter())
        .filter(|item| item.item_type == "output_text")
        .filter_map(|item| item.text.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    if segments.is_empty() {
        None
    } else {
        Some(segments.join("\n"))
    }
}

fn truncate_detail(value: &str) -> String {
    if value.chars().count() <= MAX_DETAIL_CHARS {
        return value.to_string();
    }

    value.chars().take(MAX_DETAIL_CHARS).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        ENV_LOCK.get_or_init(|| Mutex::new(()))
    }

    fn clear_translation_env() {
        unsafe {
            env::remove_var(ENV_OPENAI_API_KEY);
            env::remove_var(ENV_TRANSLATION_MODEL);
            env::remove_var(ENV_TRANSLATION_TIMEOUT_MS);
            env::remove_var(ENV_LIBRETRANSLATE_URL);
            env::remove_var(ENV_LIBRETRANSLATE_API_KEY);
        }
    }

    #[test]
    fn config_uses_default_public_libretranslate_without_env() {
        let _guard = env_lock().lock().expect("lock env");
        clear_translation_env();

        let config = TranslationConfig::from_env().expect("default public provider should exist");
        assert_eq!(config.timeout_ms, DEFAULT_TIMEOUT_MS);
        assert_eq!(config.providers.len(), 1);
        assert_eq!(config.providers[0].kind(), PROVIDER_LIBRETRANSLATE);
        match &config.providers[0] {
            ProviderConfig::LibreTranslate {
                url,
                api_key,
                model,
            } => {
                assert_eq!(url, "https://translate.cutie.dating/translate");
                assert_eq!(api_key, &None);
                assert_eq!(model, DEFAULT_PUBLIC_LIBRETRANSLATE_MODEL);
            }
            ProviderConfig::OpenAi { .. } => panic!("unexpected openai provider"),
        }
    }

    #[test]
    fn config_uses_defaults_and_overrides() {
        let _guard = env_lock().lock().expect("lock env");
        clear_translation_env();
        unsafe {
            env::set_var(ENV_OPENAI_API_KEY, "test-key");
            env::set_var(ENV_TRANSLATION_MODEL, "gpt-test-mini");
            env::set_var(ENV_TRANSLATION_TIMEOUT_MS, "9000");
        }

        let config = TranslationConfig::from_env().expect("config should parse");
        assert_eq!(config.timeout_ms, 9000);
        assert_eq!(config.providers.len(), 2);
        assert_eq!(config.providers[0].kind(), PROVIDER_LIBRETRANSLATE);
        assert_eq!(config.providers[1].kind(), PROVIDER_OPENAI);

        clear_translation_env();
    }

    #[test]
    fn config_prefers_custom_libretranslate_when_url_is_present() {
        let _guard = env_lock().lock().expect("lock env");
        clear_translation_env();
        unsafe {
            env::set_var(ENV_OPENAI_API_KEY, "test-key");
            env::set_var(ENV_LIBRETRANSLATE_URL, "http://127.0.0.1:5000");
        }

        let config = TranslationConfig::from_env().expect("config should parse");
        assert_eq!(config.providers.len(), 1);
        assert_eq!(config.providers[0].kind(), PROVIDER_LIBRETRANSLATE);
        match &config.providers[0] {
            ProviderConfig::LibreTranslate { url, .. } => {
                assert_eq!(url, "http://127.0.0.1:5000/translate");
            }
            ProviderConfig::OpenAi { .. } => panic!("unexpected openai provider"),
        }

        clear_translation_env();
    }

    #[test]
    fn extract_output_text_reads_responses_api_payload() {
        let response: ResponsesApiResponse = serde_json::from_value(json!({
            "output": [
                {
                    "type": "message",
                    "content": [
                        { "type": "output_text", "text": "技能描述" },
                        { "type": "output_text", "text": "第二行" }
                    ]
                },
                {
                    "type": "reasoning"
                }
            ]
        }))
        .expect("parse response payload");

        assert_eq!(
            extract_output_text(&response).as_deref(),
            Some("技能描述\n第二行")
        );
    }

    #[test]
    fn extract_libretranslate_text_reads_payload() {
        let response: LibreTranslateResponse = serde_json::from_value(json!({
            "translatedText": "技能描述"
        }))
        .expect("parse libretranslate payload");

        assert_eq!(response.translated_text.as_deref(), Some("技能描述"));
    }

    #[test]
    fn build_translation_instructions_require_complete_translation() {
        let instructions = build_translation_instructions(Some("zh-CN"));
        assert!(instructions.contains("faithfully and completely"));
        assert!(instructions.contains("Do not summarize"));
        assert!(instructions.contains("Simplified Chinese (zh-CN)"));
    }

    #[test]
    fn normalize_target_language_trims_blank_values() {
        assert_eq!(
            normalize_target_language(Some(" zh-CN ")).as_deref(),
            Some("zh-CN")
        );
        assert_eq!(normalize_target_language(Some("   ")), None);
        assert_eq!(normalize_target_language(None), None);
    }

    #[test]
    fn libretranslate_url_is_normalized_to_translate_endpoint() {
        assert_eq!(
            normalize_libretranslate_url("http://127.0.0.1:5000").as_deref(),
            Some("http://127.0.0.1:5000/translate")
        );
        assert_eq!(
            normalize_libretranslate_url("http://127.0.0.1:5000/translate").as_deref(),
            Some("http://127.0.0.1:5000/translate")
        );
    }

    #[test]
    fn libretranslate_target_language_uses_provider_compatible_code() {
        assert_eq!(
            normalize_target_language_for_provider(Some("zh-CN"), PROVIDER_LIBRETRANSLATE)
                .as_deref(),
            Some("zh")
        );
        assert_eq!(
            normalize_target_language_for_provider(Some("zh-TW"), PROVIDER_LIBRETRANSLATE)
                .as_deref(),
            Some("zh")
        );
        assert_eq!(
            normalize_target_language_for_provider(Some("fr"), PROVIDER_LIBRETRANSLATE).as_deref(),
            Some("fr")
        );
    }
}
