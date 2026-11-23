import AVFoundation
import Observation
import SwiftUI

/// ☆ / ★ — marks a word as difficult (it then gets priority).
struct StarButton: View {
    @Environment(ProgressStore.self) private var progress
    let id: String
    var size: CGFloat = 34

    var body: some View {
        let on = progress.isFavorite(id)
        Button { progress.toggleFavorite(id) } label: {
            Image(systemName: on ? "star.fill" : "star")
                .font(.system(size: size * 0.52, weight: .semibold))
                .foregroundStyle(on ? Color.starGold : Color.secondary)
                .frame(width: size, height: size)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: on)
        .accessibilityLabel(on ? "Remove from difficult words" : "Mark as difficult")
    }
}

extension Color {
    static let starGold = Color(red: 245/255, green: 166/255, blue: 35/255)
}

/// European-Portuguese pronunciation with Apple's built-in voices (works offline).
@MainActor
@Observable
final class Speaker {
    private let synth = AVSpeechSynthesizer()

    var soundOn: Bool {
        didSet {
            UserDefaults.standard.set(soundOn, forKey: "soundOn")
            if !soundOn { synth.stopSpeaking(at: .immediate) }
        }
    }

    init() {
        soundOn = UserDefaults.standard.object(forKey: "soundOn") as? Bool ?? true
        #if os(iOS)
        // Play even when the iPhone's silent switch is on (the in-app mute button decides).
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        #endif
    }

    /// Best Portuguese voice on this device: European Portuguese, highest quality first.
    private var voice: AVSpeechSynthesisVoice? {
        let pt = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("pt") }
        let sorted = pt.sorted {
            let a = ($0.language == "pt-PT" ? 10 : 0) + $0.quality.rawValue
            let b = ($1.language == "pt-PT" ? 10 : 0) + $1.quality.rawValue
            return a > b
        }
        return sorted.first ?? AVSpeechSynthesisVoice(language: "pt-PT")
    }

    func speak(_ text: String) {
        guard soundOn else { return }
        synth.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: PT.spoken(text))
        u.voice = voice
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
        synth.speak(u)
    }
}

/// 🔊 / 🔇 toggle for toolbars.
struct MuteButton: View {
    @Environment(Speaker.self) private var speaker

    var body: some View {
        Button {
            speaker.soundOn.toggle()
        } label: {
            Image(systemName: speaker.soundOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                .foregroundStyle(speaker.soundOn ? Color.accentColor : .secondary)
        }
        .accessibilityLabel(speaker.soundOn ? "Mute sound" : "Turn sound on")
    }
}

/// Small round speaker button used on cards and lists.
struct SpeakButton: View {
    @Environment(Speaker.self) private var speaker
    let text: String
    var size: CGFloat = 44

    var body: some View {
        Button {
            speaker.speak(text)
        } label: {
            Image(systemName: "speaker.wave.2.fill")
                .font(.system(size: size * 0.38))
                .frame(width: size, height: size)
                .background(Circle().fill(Color.secondary.opacity(0.12)))
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.accentColor)
        .opacity(speaker.soundOn ? 1 : 0.3)
        .accessibilityLabel("Speak")
    }
}
