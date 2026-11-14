import Foundation
import Observation

/// Learning state of one card — same fields as the web app (times in ms since 1970).
struct CardState: Codable, Equatable {
    var box: Int
    var due: Double
    var seen: Bool
    var t: Double?     // when last answered (used to merge devices)
}

/// File format shared with the web app's "Send progress" / "Load progress".
struct ProgressFile: Codable {
    var app: String = "pt-vocab"
    var v: Int = 1
    var exported: Double
    var progress: [String: CardState]
}

/// Spaced repetition (Leitner boxes) + saving + iCloud sync between devices.
@MainActor
@Observable
final class ProgressStore {
    /// Days until the next review, per box. Box 0 = new.
    static let intervals: [Double] = [0, 1, 3, 7, 16, 35, 90]
    static var maxBox: Int { intervals.count - 1 }
    static let learnBatch = 10
    private static let day: Double = 24 * 60 * 60 * 1000
    private static let key = "progress-v1"

    private(set) var states: [String: CardState] = [:]
    /// Bumped on every change so views refresh their numbers.
    private(set) var revision = 0

    private let cloud = NSUbiquitousKeyValueStore.default

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.key),
           let s = try? JSONDecoder().decode([String: CardState].self, from: data) {
            states = s
        }
        NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: cloud, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.pullFromCloud() }
        }
        cloud.synchronize()
        pullFromCloud()
    }

    nonisolated static func now() -> Double { Date().timeIntervalSince1970 * 1000 }

    // MARK: SRS

    func state(_ id: String) -> CardState { states[id] ?? CardState(box: 0, due: 0, seen: false) }
    func isNew(_ id: String) -> Bool { !state(id).seen }
    func isLearned(_ id: String) -> Bool { state(id).box >= 2 }
    func isDue(_ id: String, now: Double = ProgressStore.now()) -> Bool {
        let s = state(id)
        return s.seen && s.due <= now
    }

    func rate(_ id: String, correct: Bool) {
        let s = state(id)
        let box = correct ? min(Self.maxBox, s.box + 1) : 1
        let now = Self.now()
        states[id] = CardState(box: box, due: now + Self.intervals[box] * Self.day, seen: true, t: now)
        save()
    }

    struct Stats { var due = 0, learned = 0, new = 0, total = 0 }

    func stats(_ cards: [Card]) -> Stats {
        _ = revision
        let now = Self.now()
        var s = Stats(total: cards.count)
        for c in cards {
            if isNew(c.id) { s.new += 1; continue }
            if isLearned(c.id) { s.learned += 1 }
            if isDue(c.id, now: now) { s.due += 1 }
        }
        return s
    }

    /// Due reviews (shuffled) + up to 10 new words — exactly like the web app.
    func learnQueue(_ cards: [Card]) -> [Card] {
        let now = Self.now()
        let due = cards.filter { isDue($0.id, now: now) }.shuffled()
        let new = cards.filter { isNew($0.id) }.prefix(Self.learnBatch)
        return due + new
    }

    func resetAll() {
        states = [:]
        save(pushToCloud: false)
        cloud.removeObject(forKey: Self.key)
    }

    // MARK: Saving + merging

    private func save(pushToCloud: Bool = true) {
        revision += 1
        if let data = try? JSONEncoder().encode(states) {
            UserDefaults.standard.set(data, forKey: Self.key)
            if pushToCloud { cloud.set(data, forKey: Self.key) }
        }
    }

    /// Is `b` (from elsewhere) newer/better than `a` (this device)?
    private static func wins(_ b: CardState, over a: CardState?) -> Bool {
        guard let a else { return true }
        switch (b.t, a.t) {
        case let (bt?, at?): return bt > at                          // latest answer wins
        case (nil, nil): return b.box > a.box || (b.box == a.box && b.due > a.due)
        default: return b.box != a.box ? b.box > a.box : b.t != nil
        }
    }

    private static func valid(_ s: CardState) -> Bool {
        s.box >= 0 && s.box <= maxBox && s.due.isFinite
    }

    /// Merge another device's progress in. Returns how many words changed.
    @discardableResult
    func merge(_ incoming: [String: CardState], pushToCloud: Bool = true) -> Int {
        var changed = 0
        for (id, s) in incoming where Self.valid(s) && Self.wins(s, over: states[id]) {
            states[id] = s
            changed += 1
        }
        if changed > 0 { save(pushToCloud: pushToCloud) }
        return changed
    }

    // MARK: iCloud (automatic sync between iPhone, iPad and Mac)

    private func pullFromCloud() {
        guard let data = cloud.data(forKey: Self.key),
              let remote = try? JSONDecoder().decode([String: CardState].self, from: data) else {
            // Nothing in iCloud yet: upload what this device has.
            if !states.isEmpty, let d = try? JSONEncoder().encode(states) { cloud.set(d, forKey: Self.key) }
            return
        }
        merge(remote, pushToCloud: false)
        // Upload the combined result so every device ends up the same.
        if let d = try? JSONEncoder().encode(states), d != data { cloud.set(d, forKey: Self.key) }
    }

    // MARK: Progress files (compatible with the web app)

    func exportFile() throws -> URL {
        let file = ProgressFile(exported: Self.now(), progress: states)
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        let day = ISO8601DateFormatter.string(from: Date(), timeZone: .current, formatOptions: [.withFullDate])
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("portugues-progress-\(day).json")
        try enc.encode(file).write(to: url, options: .atomic)
        return url
    }

    enum ImportError: LocalizedError {
        case notAProgressFile
        var errorDescription: String? {
            "That isn't a progress file from this app. Pick the “portugues-progress-….json” file."
        }
    }

    /// Load a progress file (from this app or the web app). Returns words changed.
    func importFile(_ url: URL) throws -> (changed: Int, exported: Date?) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              raw["app"] as? String == "pt-vocab",
              let prog = raw["progress"] as? [String: Any] else { throw ImportError.notAProgressFile }
        // Decode entry by entry so one odd entry can't spoil the whole file.
        var incoming: [String: CardState] = [:]
        for (id, value) in prog {
            guard let d = try? JSONSerialization.data(withJSONObject: value),
                  let s = try? JSONDecoder().decode(CardState.self, from: d) else { continue }
            incoming[id] = s
        }
        let exported = (raw["exported"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) }
        return (merge(incoming), exported)
    }
}
