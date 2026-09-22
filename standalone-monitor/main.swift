import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var retryCount = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        let windowWidth: CGFloat = 1380
        let windowHeight: CGFloat = 920
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let rect = NSRect(
            x: (screenRect.width - windowWidth) / 2 + screenRect.minX,
            y: (screenRect.height - windowHeight) / 2 + screenRect.minY,
            width: windowWidth,
            height: windowHeight
        )
        
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Bocas Project — DevOps & System Health Monitor"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = NSColor(red: 0.035, green: 0.055, blue: 0.09, alpha: 1.0)
        window.delegate = self

        let config = WKWebViewConfiguration()
        // Permite playback audio pentru semnalul sonor de notificare
        config.mediaTypesRequiringUserActionForPlayback = []
        
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        window.contentView?.addSubview(webView)

        loadMonitorDashboard()

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func loadMonitorDashboard() {
        guard let url = URL(string: "http://127.0.0.1:3000/?view=devops") else { return }
        
        // Verifică dacă serverul local răspunde, dacă nu, îl pornește
        let task = URLSession.shared.dataTask(with: url) { [weak self] (_, response, error) in
            DispatchQueue.main.async {
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    self?.webView.load(URLRequest(url: url))
                } else {
                    // Dacă serverul nu rulează, îl lansăm în fundal
                    if self?.retryCount == 0 {
                        self?.launchLocalServer()
                    }
                    self?.retryCount += 1
                    if (self?.retryCount ?? 0) < 15 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                            self?.loadMonitorDashboard()
                        }
                    } else {
                        // Fallback: încearcă direct URL-ul
                        self?.webView.load(URLRequest(url: url))
                    }
                }
            }
        }
        task.resume()
    }

    func launchLocalServer() {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-l", "-c", "cd '/Users/florindorobantu/Desktop/Proiect_Adrian_Besleaga' && npm run preview &"]
        try? process.run()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
