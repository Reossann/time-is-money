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

pub const DEFAULT_TONE: NotificationTone = NotificationTone::Spartan;

pub fn pick_random_message(tone: NotificationTone) -> &'static str {
    let mut rng = rand::rng();
    pick_random_message_with_rng(messages_for(tone), &mut rng)
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
}
