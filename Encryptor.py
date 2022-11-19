# dont mind about this      :D

# eng = 'ਓਅੲਸਹਕਖਗਘਙਚਛਜਝਞਟਠਡਢਣਤਥਦਧਨਪਫਬਭਮਯਰਲਵੜਸ਼ਖ਼ਗ਼ਜ਼ਫ਼ਲ਼'
# for _ in eng:
#     Punjabi.append(_)
#
# print(Punjabi)
# random.shuffle(Punjabi)
#
# print(Punjabi)

# letters lists

English = ['T', '=', ';', '}', 'N', 'Z', '_', 'P', ']', '%', 'E', 'J', 'j', 'l', 'v', 'Y', '7', '(', '2', 'F', '4', 'B',
           'S', 'G', 'K', 'Q', 'M', 'R', 'n', '5', ')', '3', 'A', '<', 'X', '@', '!', 'r', '6', '\\', '.', 'h', '|',
           'f', ',', '#', 'U', '[', 'D', 'w', 'y', ' ', '^', 'H', '?', 'i', 'd', 'O', '+', 't', '*', '{', "'", 'g', 'm',
           '$', 'b', '&', 'q', '-', '9', ':', 'z', '8', '1', 'c', '`', '"', 'u', 'k', '>', 'L', '/', 'V', 'o', 'x', 'C',
           'p', 'I', 's', 'e', 'W', '~', 'a', '0', '\t', '\n', '\x0b', '\x0c']

Arabic = ['$', 'ظ', '8', 'ذ', '(', '’', '3', '@', '=', '.', '[', 'ا', 'آ', 'ى', 'ب', ',', 'م', '>', 'خ', '"', '4', 'أ',
          'ؤ', 'ه', '؟', 'ت', '÷', 'و', '+', '-', 'س', 'ط', '×', 'ر', '‘', '،', '^', 'ق', '#', ')', '1', '/', 'ض', '9',
          '6', '!', '2', '&', 'ن', '%', '{', '_', 'إ', 'د', 'ل', ']', '<', 'ع', 'ئ', 'ز', 'ء', '5', 'ج', '0', 'ش', 'ث',
          'ح', 'ص', 'ي', ':', '}', '7', 'غ', '*', 'ف', 'ة', 'ك', 'ـ', ' ', '\t', '\n', '\x0b', '\x0c']

Russian = ['и', 'Т', 'Ц', 'Ъ', 'А', 'Ь', 'Ю', 'Ч', 'в', 'э', 'Г', 'И', 'Ы', 'Ж', 'г', 'ы', 'н', 'б', 'ж', 'Щ', 'Р', 'х',
           'Х', 'ш', 'с', 'М', 'Э', 'Е', 'п', 'д', 'р', 'Д', 'З', 'Ф', 'у', 'з', 'ц', 'а', 'я', 'Я', 'л', 'Б', 'У', 'ё',
           'В', 'ь', 'м', 'Ш', 'т', 'ю', 'Й', 'О', 'К', 'Л', 'ъ', 'е', 'ч', 'Ё', 'щ', 'к', 'П', 'Н', 'ф', 'С', 'о', 'й']

Punjabi = ['ਙ', 'ਬ', 'ਝ', 'ਲ', 'ਦ', 'ਸ਼', 'ਰ', 'ਞ', 'ਕ', 'ਛ', 'ਭ', 'ਮ', 'ਯ', 'ੜ', 'ਖ', 'ਹ', 'ਵ', 'ਜ', 'ਘ', 'ਪ', 'ਫ', 'ਢ',
           'ਠ', 'ਸ', 'ਡ', 'ਤ', 'ਅ', 'ਚ', 'ਖ', 'ੲ', 'ਗ', 'ਓ', 'ਧ', 'ਣ', 'ਲ', 'ਗ', 'ਨ', 'ਥ', 'ਟ', 'ਜ਼', 'ਫ']

# the default key

key = "EAR-100"

# the key has to start with letters (A, E, P, R. for now) then a "-" then an integer
# every different order will give different encrypting, same for different integers

# it's better not to change anything below +_+

allList = []


def _test_func(key, multiline):
    global allList
    Klist = str(key).split("-")
    try:
        int(Klist[1])
    except:
        return False

    if "A" in Klist[0]:
        allList.extend(Arabic)
    if "E" in Klist[0]:
        allList.extend(English)
    if "R" in Klist[0]:
        allList.extend(Russian)
    if "P" in Klist[0]:
        allList.extend(Punjabi)

    allList = list(dict.fromkeys(allList))
    if not multiline:
        try:
            allList.remove("\n")
        except:
            pass
    return Klist[1]


def Encrypt(text, key, error_continue=False, multiline=True):
    realkey = int(_test_func(key, multiline))

    if allList == []:
        raise KeyError("Invalid key")

    wordList = []
    encedList = []

    for _ in text:
        wordList.append(_)

    for _ in range(len(wordList)):
        try:
            index = allList.index(wordList[_])
        except:
            if error_continue:
                continue
            else:
                raise IndexError("Letter not found (could be invalid key), try setting error_continue to True")

        index += realkey
        while index >= len(allList):
            index -= len(allList)
        while index < 0:
            index += len(allList)

        encedList.append(allList[index])

    allList.clear()

    return "".join(encedList)


def Decrypt(text, key, error_continue=False, multiline=True):
    realkey = int(_test_func(key, multiline))

    wordList = []
    encedList = []

    for _ in text:
        wordList.append(_)

    for _ in range(len(wordList)):
        try:
            index = allList.index(wordList[_])
        except:
            if error_continue:
                continue
            else:
                raise IndexError("Letter not found (could be invalid key), try setting error_continue to True")
        index -= realkey
        while index >= len(allList):
            index -= len(allList)
        while index < 0:
            index += len(allList)

        encedList.append(allList[index])

    allList.clear()

    return "".join(encedList)

if __name__ == '__main__':

    while True:
        x = input("dec or enc or key >> ")
        if x == 'key':
            key = input("Enter a Key >> ")
            print(_test_func(key, False))
        else:
            text = input('Enter some text >> ')

            if x == "dec":
                print(Decrypt(text, key, False))
            elif x == "enc":
                print(Encrypt(text, key, False))