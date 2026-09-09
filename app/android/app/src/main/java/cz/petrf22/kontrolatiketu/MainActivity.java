package cz.petrf22.kontrolatiketu;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/**
 * Hlavní aktivita.
 *
 * FLAG_SECURE se nastavuje hned v onCreate, ještě než se cokoliv vykreslí. Zabrání
 * screenshotům, nahrávání obrazovky i náhledu v přepínači aplikací — jinak by obsah tiketu
 * a výsledek vyhodnocení byly vidět komukoliv, kdo si projde přepínač.
 *
 * Je to akceptační kritérium ze zadání, ne kosmetika. Neodstraňuj to ani kvůli pohodlnějšímu
 * ladění.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        super.onCreate(savedInstanceState);
    }
}
