use rand::prelude::IndexedRandom;
use rand::Rng;

const FALLBACK_MESSAGE: &str = "Time Is Moneyを使っています";

const SPARTAN_MESSAGES: &[&str] = &[
    "おい、手が止まってるぞ。時間はタダじゃないんだが？",
    "サボり検出！今この瞬間もハッカソンの残り時間が減っています。",
    "またSNS見てない？その3分があれば1機能作れたよね？",
    "現実逃避は終了！黙ってキーボードに手を戻しなさい！",
    "締め切り『やあ、僕だよ。準備はできてるかい？』",
];

const GENTLE_MESSAGES: &[&str] = &[
    "お疲れ様です！そろそろ次の作業に取りかかってみませんか？",
    "一歩ずつ進めば大丈夫。無理せず自分のペースで頑張りましょう！",
    "少し集中が切れてきたかも？深呼吸して、もうひと踏ん張りです！",
    "いつも頑張っていて素敵です！今日やりたいこと、応援しています。",
    "水分補給も忘れずにね。あなたのペースで進めていきましょう！",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NotificationTone {
    Spartan,
    Gentle,
}

impl NotificationTone {
    pub fn from_setting_value(value: &str) -> Self {
        match value {
            "gentle" => Self::Gentle,
            "sparta" => Self::Spartan,
            _ => Self::Spartan,
        }
    }
}

pub const DEFAULT_TONE: NotificationTone = NotificationTone::Spartan;
pub const DEFAULT_NOTIFICATION_INTERVAL_MINUTES: u32 = 30;

pub fn pick_random_message(tone: NotificationTone) -> &'static str {
    let mut rng = rand::rng();
    pick_random_message_with_rng(messages_for(tone), &mut rng)
}

pub fn notification_delay_from_interval(minutes: u32) -> std::time::Duration {
    let validated_minutes = match minutes {
        15 | 30 | 60 | 120 => minutes,
        _ => DEFAULT_NOTIFICATION_INTERVAL_MINUTES,
    };

    std::time::Duration::from_secs((validated_minutes as u64) * 60)
}

fn messages_for(tone: NotificationTone) -> &'static [&'static str] {
    match tone {
        NotificationTone::Spartan => SPARTAN_MESSAGES,
        NotificationTone::Gentle => GENTLE_MESSAGES,
    }
}

fn pick_random_message_with_rng<R: Rng + ?Sized>(
    messages: &'static [&'static str],
    rng: &mut R,
) -> &'static str {
    messages.choose(rng).copied().unwrap_or(FALLBACK_MESSAGE)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{rngs::StdRng, SeedableRng};

    #[test]
    fn picks_message_from_requested_tone() {
        let mut rng = StdRng::seed_from_u64(42);

        let spartan = pick_random_message_with_rng(SPARTAN_MESSAGES, &mut rng);
        let gentle = pick_random_message_with_rng(GENTLE_MESSAGES, &mut rng);

        assert!(SPARTAN_MESSAGES.contains(&spartan));
        assert!(GENTLE_MESSAGES.contains(&gentle));
    }

    #[test]
    fn uses_fallback_when_message_group_is_empty() {
        let mut rng = StdRng::seed_from_u64(42);

        let message = pick_random_message_with_rng(&[], &mut rng);

        assert_eq!(message, FALLBACK_MESSAGE);
    }

    #[test]
    fn default_tone_is_spartan() {
        assert_eq!(DEFAULT_TONE, NotificationTone::Spartan);
    }

    #[test]
    fn maps_setting_tone_values_to_notification_tone() {
        assert_eq!(
            NotificationTone::from_setting_value("gentle"),
            NotificationTone::Gentle
        );
        assert_eq!(
            NotificationTone::from_setting_value("sparta"),
            NotificationTone::Spartan
        );
        assert_eq!(
            NotificationTone::from_setting_value("unknown"),
            NotificationTone::Spartan
        );
    }

    #[test]
    fn converts_notification_interval_minutes_to_duration() {
        assert_eq!(
            notification_delay_from_interval(15),
            std::time::Duration::from_secs(900)
        );
        assert_eq!(
            notification_delay_from_interval(60),
            std::time::Duration::from_secs(3600)
        );
    }

    #[test]
    fn falls_back_to_the_default_delay_for_an_invalid_interval() {
        assert_eq!(
            notification_delay_from_interval(0),
            std::time::Duration::from_secs(1800)
        );
        assert_eq!(
            notification_delay_from_interval(10),
            std::time::Duration::from_secs(1800)
        );
    }
}
