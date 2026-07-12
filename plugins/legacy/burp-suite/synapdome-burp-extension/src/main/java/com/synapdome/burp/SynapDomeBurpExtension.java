package com.synapdome.burp;

import burp.IBurpExtender;
import burp.IBurpExtenderCallbacks;
import burp.IContextMenuFactory;
import burp.IContextMenuInvocation;
import burp.IHttpRequestResponse;
import burp.ITab;

import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JMenuItem;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;

public class SynapDomeBurpExtension implements IBurpExtender, ITab, IContextMenuFactory {
    private IBurpExtenderCallbacks callbacks;
    private PrintWriter stdout;
    private JTextField apiBaseUrl;
    private JPasswordField apiToken;
    private JTextField tenantId;
    private JTextField engagementId;
    private JTextField targetUrl;
    private JTextField allowedDomains;
    private JTextArea log;
    private JPanel panel;

    @Override
    public void registerExtenderCallbacks(IBurpExtenderCallbacks callbacks) {
        this.callbacks = callbacks;
        this.stdout = new PrintWriter(callbacks.getStdout(), true);
        callbacks.setExtensionName("SynapDome Burp Capture");
        buildUi();
        callbacks.addSuiteTab(this);
        callbacks.registerContextMenuFactory(this);
        writeLog("SynapDome Burp Capture loaded");
    }

    @Override
    public String getTabCaption() {
        return "SynapDome";
    }

    @Override
    public JComponent getUiComponent() {
        return panel;
    }

    @Override
    public List<JMenuItem> createMenuItems(IContextMenuInvocation invocation) {
        List<JMenuItem> items = new ArrayList<JMenuItem>();
        JMenuItem send = new JMenuItem("Send selected messages to SynapDome");
        send.addActionListener((ActionEvent event) -> {
            IHttpRequestResponse[] selected = invocation.getSelectedMessages();
            if (selected == null || selected.length == 0) {
                writeLog("No Burp messages selected");
                return;
            }
            new Thread(() -> uploadMessages(selected), "synapdome-upload").start();
        });
        items.add(send);
        return items;
    }

    private void buildUi() {
        panel = new JPanel(new BorderLayout(10, 10));
        JPanel fields = new JPanel(new GridLayout(0, 2, 8, 8));

        apiBaseUrl = field("apiBaseUrl", "https://synapdome.example.com");
        apiToken = passwordField("apiToken");
        tenantId = field("tenantId", "");
        engagementId = field("engagementId", "");
        targetUrl = field("targetUrl", "");
        allowedDomains = field("allowedDomains", "");

        fields.add(new JLabel("SynapDome API URL"));
        fields.add(apiBaseUrl);
        fields.add(new JLabel("API token"));
        fields.add(apiToken);
        fields.add(new JLabel("Tenant ID"));
        fields.add(tenantId);
        fields.add(new JLabel("Engagement ID"));
        fields.add(engagementId);
        fields.add(new JLabel("Target URL"));
        fields.add(targetUrl);
        fields.add(new JLabel("Allowed domains"));
        fields.add(allowedDomains);

        JButton save = new JButton("Save settings");
        save.addActionListener((ActionEvent event) -> saveSettings());

        log = new JTextArea(10, 80);
        log.setEditable(false);

        panel.add(fields, BorderLayout.NORTH);
        panel.add(save, BorderLayout.CENTER);
        panel.add(new JScrollPane(log), BorderLayout.SOUTH);
    }

    private JTextField field(String key, String fallback) {
        String stored = callbacks.loadExtensionSetting(key);
        return new JTextField(stored == null ? fallback : stored);
    }

    private JPasswordField passwordField(String key) {
        String stored = callbacks.loadExtensionSetting(key);
        return new JPasswordField(stored == null ? "" : stored);
    }

    private void saveSettings() {
        callbacks.saveExtensionSetting("apiBaseUrl", apiBaseUrl.getText().trim());
        callbacks.saveExtensionSetting("apiToken", new String(apiToken.getPassword()));
        callbacks.saveExtensionSetting("tenantId", tenantId.getText().trim());
        callbacks.saveExtensionSetting("engagementId", engagementId.getText().trim());
        callbacks.saveExtensionSetting("targetUrl", targetUrl.getText().trim());
        callbacks.saveExtensionSetting("allowedDomains", allowedDomains.getText().trim());
        writeLog("Saved settings");
    }

    private void uploadMessages(IHttpRequestResponse[] messages) {
        try {
            saveSettings();
            String endpoint = trimSlash(apiBaseUrl.getText().trim()) + "/api/redteam/artifacts/burp";
            String payload = buildPayload(messages);
            HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setDoOutput(true);
            connection.setRequestProperty("content-type", "application/json");
            connection.setRequestProperty("authorization", "Bearer " + new String(apiToken.getPassword()));

            byte[] body = payload.getBytes(StandardCharsets.UTF_8);
            connection.setRequestProperty("content-length", String.valueOf(body.length));
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }

            int status = connection.getResponseCode();
            writeLog("Uploaded " + messages.length + " messages. SynapDome response: HTTP " + status);
        } catch (Exception error) {
            writeLog("Upload failed: " + error.getMessage());
        }
    }

    private String buildPayload(IHttpRequestResponse[] messages) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        addJsonField(json, "source", "burp-suite", true);
        addJsonField(json, "tenantId", tenantId.getText().trim(), true);
        addJsonField(json, "engagementId", engagementId.getText().trim(), true);
        addJsonField(json, "targetUrl", targetUrl.getText().trim(), true);
        json.append("\"allowedDomains\":").append(stringArray(allowedDomains.getText())).append(",");
        addJsonField(json, "capturedAt", java.time.Instant.now().toString(), true);
        json.append("\"messages\":[");
        for (int i = 0; i < messages.length; i++) {
            if (i > 0) json.append(",");
            json.append(messageJson(messages[i]));
        }
        json.append("]}");
        return json.toString();
    }

    private String messageJson(IHttpRequestResponse message) {
        byte[] request = message.getRequest();
        byte[] response = message.getResponse();
        String requestText = request == null ? "" : new String(request, StandardCharsets.ISO_8859_1);
        String responseText = response == null ? "" : new String(response, StandardCharsets.ISO_8859_1);
        String firstLine = requestText.split("\\r?\\n", 2)[0];
        String statusLine = responseText.split("\\r?\\n", 2)[0];

        StringBuilder json = new StringBuilder();
        json.append("{");
        addJsonField(json, "requestLine", firstLine, true);
        addJsonField(json, "responseLine", statusLine, true);
        addJsonField(json, "requestPreview", preview(requestText), true);
        addJsonField(json, "responsePreview", preview(responseText), false);
        json.append("}");
        return json.toString();
    }

    private void addJsonField(StringBuilder json, String key, String value, boolean comma) {
        json.append("\"").append(escape(key)).append("\":\"").append(escape(value)).append("\"");
        if (comma) json.append(",");
    }

    private String stringArray(String csv) {
        StringBuilder json = new StringBuilder("[");
        String[] parts = csv.split(",");
        int count = 0;
        for (String part : parts) {
            String value = part.trim();
            if (value.isEmpty()) continue;
            if (count > 0) json.append(",");
            json.append("\"").append(escape(value)).append("\"");
            count++;
        }
        json.append("]");
        return json.toString();
    }

    private String preview(String value) {
        String redacted = value
                .replaceAll("(?i)(Authorization:\\s*)([^\\r\\n]+)", "$1<redacted>")
                .replaceAll("(?i)(Cookie:\\s*)([^\\r\\n]+)", "$1<redacted>")
                .replaceAll("(?i)(Set-Cookie:\\s*)([^\\r\\n]+)", "$1<redacted>");
        return redacted.length() <= 12000 ? redacted : redacted.substring(0, 12000);
    }

    private String escape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }

    private String trimSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private void writeLog(String message) {
        String line = java.time.LocalTime.now() + " " + message;
        stdout.println(line);
        if (log != null) {
            javax.swing.SwingUtilities.invokeLater(() -> log.append(line + "\n"));
        }
    }
}
