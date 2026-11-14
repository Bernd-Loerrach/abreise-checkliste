import Foundation
import Observation

// MARK: - Data model (same content as the web app's data.js / conjugations.js)

struct CardData: Codable, Hashable {
    let pt: String
    let en: String
    let note: String?
}

struct DeckData: Codable, Hashable {
    let id: String
    let icon: String
    let name: String
    let namePt: String
    let cards: [CardData]
}

struct ConjEntry: Codable, Hashable {
    let f: [String]          // presente: eu, tu, ele, nós, eles
    let t: String            // regular / irregular / impersonal
    let p: [String]?         // pretérito perfeito
    let tp: String?
    let i: [String]?         // imperativo: tu, não tu, você, vocês
    let ti: String?
}

struct VocabFile: Codable {
    let version: Int
    let decks: [DeckData]
    let conj: [String: ConjEntry]
}

/// One flashcard. `id` is identical to the web app ("deckId:pt"), so progress
/// files can move between the web app and this app.
struct Card: Identifiable, Hashable {
    let id: String
    let pt: String
    let en: String
    let note: String?
    let deckId: String
    let deckName: String
    let deckIcon: String
}

struct Deck: Identifiable, Hashable {
    let id: String
    let icon: String
    let name: String
    let namePt: String
    let cards: [Card]
}

// MARK: - Vocabulary store

/// Loads the bundled vocabulary, then quietly checks the website for a newer
/// word list (so new words don't need a new App Store version).
@MainActor
@Observable
final class VocabStore {
    static let remoteURL = URL(string: "https://bernd-loerrach.github.io/abreise-checkliste/vokabeln/vocab.json")!

    private(set) var decks: [Deck] = []
    private(set) var allCards: [Card] = []
    private(set) var conj: [String: ConjEntry] = [:]
    private(set) var version: Int = 0

    private var cacheURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("vocab.json")
    }

    init() {
        let bundled = Self.decode(Bundle.main.url(forResource: "vocab", withExtension: "json").flatMap { try? Data(contentsOf: $0) })
        let cached = Self.decode(try? Data(contentsOf: cacheURL))
        if let best = [bundled, cached].compactMap({ $0 }).max(by: { $0.version < $1.version }) {
            apply(best)
        }
    }

    private static func decode(_ data: Data?) -> VocabFile? {
        guard let data else { return nil }
        return try? JSONDecoder().decode(VocabFile.self, from: data)
    }

    private func apply(_ file: VocabFile) {
        version = file.version
        conj = file.conj
        decks = file.decks.map { d in
            Deck(id: d.id, icon: d.icon, name: d.name, namePt: d.namePt,
                 cards: d.cards.map { c in
                     Card(id: d.id + ":" + c.pt, pt: c.pt, en: c.en, note: c.note,
                          deckId: d.id, deckName: d.name, deckIcon: d.icon)
                 })
        }
        allCards = decks.flatMap(\.cards)
    }

    /// Fetch a newer word list from the website, if there is one.
    func refreshFromWeb() async {
        var req = URLRequest(url: Self.remoteURL)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 15
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let file = Self.decode(data), file.version > version, !file.decks.isEmpty
        else { return }
        try? data.write(to: cacheURL, options: .atomic)
        apply(file)
    }

    func conjugation(for card: Card) -> ConjEntry? { conj[card.pt] }
}

// MARK: - Text helpers

enum PT {
    /// "(o) abraço" -> "abraço"; "pensar (em)" -> "pensar" (for speech).
    static func spoken(_ s: String) -> String {
        var t = s.replacingOccurrences(of: #"^\([^)]*\)\s*"#, with: "", options: .regularExpression)
        t = t.replacingOccurrences(of: #"\s*\([^)]*\)\s*$"#, with: "", options: .regularExpression)
        return t
    }

    /// Clean word for a dictionary lookup (same rules as the web app).
    static func lookupWord(_ pt: String) -> String {
        let t = spoken(pt).components(separatedBy: ",")[0]
        return t.replacingOccurrences(of: #"[?!.¿¡…]"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces).lowercased()
    }

    static func infopediaDict(_ pt: String) -> URL {
        let w = lookupWord(pt).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ""
        return URL(string: "https://www.infopedia.pt/dicionarios/portugues-ingles/" + w)!
    }

    static func infopediaVerb(_ pt: String) -> URL {
        var v = lookupWord(pt).replacingOccurrences(of: #"-se$"#, with: "", options: .regularExpression)
        v = v.components(separatedBy: " ")[0]
        let w = v.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ""
        return URL(string: "https://www.infopedia.pt/dicionarios/verbos-portugueses/" + w)!
    }
}
