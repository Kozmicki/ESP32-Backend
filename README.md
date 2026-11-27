# ESP32 Backend

ESP32 Backend je web aplikacija i API sustav namijenjen povezivanju proizvedenih ESP32 uređaja s korisničkim računima i upravljanju podacima koje uređaji prikupljaju.

Aplikacija omogućuje praćenje temperature i vlage zraka te vlage tla na četiri sonde. Povijesna očitanja prikazuju se u satnim intervalima, dok korisnici i administratori mogu upravljati rasporedom svjetla i načinom rada temperaturnog releja za grijanje ili hlađenje.

## Autentifikacija i proizvodnja uređaja

Svaki ESP32 uređaj ima jedinstven 64-znamenkasti serijski token i MAC adresu dodijeljenu tijekom proizvodnje ili registracije uređaja. Token se koristi za autorizaciju komunikacije uređaja s backendom, bez potrebe za korisničkim prijavnim podacima na samom uređaju.

Serijski token ne pohranjuje se kao čitljiv tekst. Backend iz njega izračunava SHA-256 kriptirani sažetak i uspoređuje ga prilikom autentifikacije. Na taj način valjani uređaj može slati očitanja i dohvaćati konfiguraciju samo dok mu je token aktivan i pridružen njegovoj MAC adresi i vlasniku.

## Administrator i kontrola sustava

Administrator ima potpunu kontrolu nad sustavom i može:

- kreirati i upravljati korisničkim računima
- dodijeliti proizvedeni ESP32 uređaj korisniku
- registrirati MAC adresu i serijski token uređaja
- aktivirati, deaktivirati ili ukloniti uređaje
- mijenjati serijski token nakon zamjene ili ponovne proizvodnje firmwarea
- pregledati trenutačna i povijesna očitanja svakog uređaja
- postaviti raspored svjetla i temperaturne pragove releja
- provjeriti stanje servera i MongoDB baze

Obični korisnički račun prikazuje samo njegov dodijeljeni uređaj i omogućuje praćenje očitanja te promjenu dopuštenih postavki. Deaktivirani korisnici i uređaji više ne mogu pristupiti sustavu niti slati podatke.
