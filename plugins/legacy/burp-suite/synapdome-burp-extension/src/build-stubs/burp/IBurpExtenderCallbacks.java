package burp;

import java.io.OutputStream;

public interface IBurpExtenderCallbacks {
    void setExtensionName(String name);
    OutputStream getStdout();
    void addSuiteTab(ITab tab);
    void registerContextMenuFactory(IContextMenuFactory factory);
    void saveExtensionSetting(String name, String value);
    String loadExtensionSetting(String name);
}
