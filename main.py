import pygame
import os
import threading
import math
import configparser
import random
import Encryptor

pygame.font.init()
pygame.mixer.init()
pygame.joystick.init()

JOYSTICK = [pygame.joystick.Joystick(i) for i in range(pygame.joystick.get_count())]


def missing_config():
    global maxHealth, maxStamina, speedMulti, infinityBullets, MAX_BULLETS, Player, AIMBOT, MONEY, SUPER_EZ, EZ, HARD, \
        IMPOSSIBLE

    cfg = configparser.ConfigParser()

    cfg['Player'] = {
        'maxhealth': '10',
        'maxstamina': '100',
        'speedmulti': '1',
        'maxbullets': '3',
        'infinitybullets': 'False',
        'aimbot': '1',
        'money': '0'
    }
    cfg['Mode'] = {
        'easy': 'False',
        'normal': 'False',
        'hard': 'True',
        'impossible': 'True'
    }

    Player = cfg['Player']
    maxHealth = int(Player['maxHealth'])
    maxStamina = int(Player['maxStamina'])
    speedMulti = int(Player['speedMulti'])
    infinityBullets = Player.getboolean('infinityBullets')
    MAX_BULLETS = int(Player['maxBullets'])
    AIMBOT = float(Player['aimbot'])
    MONEY = float(Player['money'])

    HARD = cfg['Mode'].getboolean('hard')
    EZ = cfg['Mode'].getboolean('normal')
    SUPER_EZ = cfg['Mode'].getboolean('easy')
    IMPOSSIBLE = cfg['Mode'].getboolean('impossible')

    playerDict = {'maxHealth': maxHealth,
                  'maxStamina': maxStamina,
                  'speedMulti': speedMulti,
                  'maxBullets': MAX_BULLETS,
                  'infinityBullets': infinityBullets,
                  'aimbot': AIMBOT,
                  'money': MONEY
                  }
    modeDict = {
        'easy': SUPER_EZ,
        'normal': EZ,
        'hard': HARD,
        'impossible': IMPOSSIBLE
    }
    for key, value in playerDict.items(): cfg['Player'][str(key)] = str(value)
    for key, value in modeDict.items(): cfg['Mode'][str(key)] = str(value)
    with open(r'config.ini', 'w') as file:
        cfg.write(file)
        file.close()
    enc_cfg = open(r'config.ini')
    enc_str = ''''''
    for line in enc_cfg.readlines(): enc_str += line

    enc_str = Encryptor.Encrypt(enc_str, 'E-10')

    enc_cfg.close()
    enc_cfg = open(r'config.ini', 'w')
    enc_cfg.write(enc_str)
    enc_cfg.close()

try:
    cfg = configparser.ConfigParser()
    enc_cfg = open(r'config.ini')
    enc_str = ''''''
    for line in enc_cfg.readlines(): enc_str += line
    enc_cfg.close()

    enc_str = Encryptor.Decrypt(enc_str, 'E-10')
    # print(enc_str)

    cfg.read_string(enc_str)
except configparser.ParsingError:
    missing_config()

try:
    Player = cfg['Player']

    maxHealth = int(Player['maxHealth'])
    maxStamina = int(Player['maxStamina'])
    speedMulti = int(Player['speedMulti'])
    infinityBullets = Player.getboolean('infinityBullets')

    MONEY = float(Player['money'])
except KeyError:
    missing_config()

JUMP = pygame.mixer.Sound(os.path.join('Assets', 'dodge.wav'))
BULLET_HIT_SOUND = pygame.mixer.Sound(os.path.join('Assets', 'Grenade+1.mp3'))
BULLET_FIRE_SOUND = pygame.mixer.Sound(os.path.join('Assets', 'Gun+Silencer.mp3'))

JUMP.set_volume(.5)
BULLET_FIRE_SOUND.set_volume(.25)
BULLET_HIT_SOUND.set_volume(.25)

YELLOW_HIT = pygame.USEREVENT + 1
RED_HIT = pygame.USEREVENT + 2

fps = 144
WIDTH, HEIGHT = 900, 500
SPACESHIP_WIDTH, SPACESHIP_HEIGHT = round(WIDTH / 18), round(HEIGHT / 7.5)
BULLET_WIDTH, BULLET_HEIGHT = round(WIDTH / 70), round(HEIGHT / 17.5)
WINDOW = pygame.display.set_mode((WIDTH, HEIGHT))
MAIN_WINDOW = pygame.display.set_mode((WIDTH, HEIGHT))

pygame.display.set_caption('Space Wars')

HEALTH_FONT = pygame.font.SysFont('comics', round(WIDTH / 22.5))
WINNER_FONT = pygame.font.SysFont('comics', round(WIDTH / 6))

VEL = round((144 / fps) * (WIDTH / 900)) * speedMulti
BULLET_VELL = round(VEL * 3)
BOOST = VEL * 50

BOT_BATTLE = False

try:
    AIMBOT = float(Player['aimbot'])
    MAX_BULLETS = int(Player['maxBullets'])
except KeyError:
    missing_config()

try:
    HARD = cfg['Mode'].getboolean('hard')
    EZ = cfg['Mode'].getboolean('normal')
    SUPER_EZ = cfg['Mode'].getboolean('easy')
    IMPOSSIBLE = cfg['Mode'].getboolean('impossible')
except KeyError:
    missing_config()

if HARD:
    EZ = False
    SUPER_EZ = False
    IMPOSSIBLE = False
elif EZ:
    HARD = False
    SUPER_EZ = False
    IMPOSSIBLE = False
elif SUPER_EZ:
    EZ = False
    HARD = False
    IMPOSSIBLE = False
elif IMPOSSIBLE:
    EZ = False
    HARD = False
    SUPER_EZ = False


def update_config():
    global HARD, EZ, SUPER_EZ, IMPOSSIBLE
    try:
        playerDict = {'maxHealth': maxHealth,
                      'maxStamina': maxStamina,
                      'speedMulti': speedMulti,
                      'maxBullets': MAX_BULLETS,
                      'infinityBullets': infinityBullets,
                      'aimbot': AIMBOT,
                      'money': MONEY
                      }
        modeDict = {
            'easy': SUPER_EZ,
            'normal': EZ,
            'hard': HARD,
            'impossible': IMPOSSIBLE
        }

        if HARD:
            EZ = False
            SUPER_EZ = False
            IMPOSSIBLE = False
        elif EZ:
            HARD = False
            SUPER_EZ = False
            IMPOSSIBLE = False
        elif SUPER_EZ:
            EZ = False
            HARD = False
            IMPOSSIBLE = False
        elif IMPOSSIBLE:
            EZ = False
            HARD = False
            SUPER_EZ = False

        for key, value in playerDict.items(): cfg['Player'][str(key)] = str(value)
        for key, value in modeDict.items(): cfg['Mode'][str(key)] = str(value)
        with open(r'config.ini', 'w') as file:
            cfg.write(file)
            file.close()
    except:
        missing_config()
        update_config()

    enc_cfg = open(r'config.ini', 'r')
    enc_str = ''''''
    for line in enc_cfg.readlines(): enc_str += line

    # print(enc_str)  # # # # # # # ## # # # # # # # # # # # # # # # # # # #   ### # # # # # # # # #

    enc_str = Encryptor.Encrypt(enc_str, 'E-10')

    enc_cfg.close()
    enc_cfg = open(r'config.ini', 'w')
    enc_cfg.write(enc_str)
    enc_cfg.close()


class Main():
    class CustomRect(pygame.Rect):

        def __init__(self, x, y, width, height, name, vel=VEL, health=maxHealth):
            self.x, self.y, self.width, self.height, self.name, self.vel = x, y, width, height, name, vel
            self.stamina = maxStamina
            self.bullets = []
            self.immune = False
            self.health = health
            self.middle_y = self.y + self.width // 2
            self.middle_x = self.x + self.height // 2
            self.max_bullets = MAX_BULLETS
            self.aimbot = AIMBOT
            self.realAimbot = None
            self.infinitybullets = infinityBullets
            self.max_stamina = maxStamina
            self.normal_vel = VEL
            self.run = False
            self.fired = True
            self.danger = False
            self.bulletVel = BULLET_VELL

        def move_right(self):
            self.x += self.vel

        def move_left(self):
            self.x -= self.vel

        def move_up(self):
            self.y -= self.vel

        def move_down(self):
            self.y += self.vel

        def boost(self):
            if self.stamina > 1:
                self.stamina -= .2
                if self.stamina > 10: self.vel = self.normal_vel * 2
                try:
                    if abs(self.speed_x) < self.normal_vel * 2 and abs(self.speed_y) < self.normal_vel * 2:
                        self.stamina += .15
                        if self.stamina < self.max_stamina:
                            self.stamina += .2
                except AttributeError:
                    pass
            else:
                self.disable_boost()

        def disable_boost(self):
            self.vel = self.normal_vel
            if self.stamina < self.max_stamina:
                self.stamina += .2

        def dodge(self, ez=False, work=True):
            try:
                if self.stamina > 45:
                    self.stamina -= 45
                    if ez:
                        self.stamina += 15
                    if self.speed_x < 0:
                        self.x -= BOOST
                    if self.speed_x > 0:
                        self.x += BOOST
                    if self.speed_y < 0:
                        self.y -= BOOST
                    if self.speed_y > 0:
                        self.y += BOOST

                    self.immune = True

                    if work:
                        unimmune = threading.Timer(.5, self.un_immune)
                        unimmune.start()
                    JUMP.play()
            except AttributeError:
                try:
                    self.before_moving()
                    self.dodge()
                    self.after_moving()
                except AttributeError:
                    self.dodge()

            else:
                self.vel = self.normal_vel

        def un_immune(self):
            self.immune = False

        def before_moving(self):
            self.last_x = self.x
            self.last_y = self.y

        def after_moving(self):
            if self.name == 'yellow':
                if self.x < 0: self.x = 0
                if self.x > WIDTH // 2 - self.height: self.x = WIDTH // 2 - self.height

            if self.name == 'red':
                if self.x < WIDTH // 2: self.x = WIDTH // 2
                if self.x > WIDTH - self.height: self.x = WIDTH - self.height

            if self.y + self.width + 10 < 0:
                self.y = HEIGHT - 10
            if self.y - self.width > HEIGHT - self.width - 10:
                self.y = 0 - self.width

            self.speed_x = self.x - self.last_x
            self.speed_y = self.y - self.last_y

            self.middle_y = self.y + self.width // 2
            self.middle_x = self.x + self.height // 2

        def fire(self):
            if len(self.bullets) < self.max_bullets:
                if self.name == 'yellow':
                    self.bullet = pygame.Rect(self.x + self.height, self.y + self.width // 2, 15, 5)
                elif self.name == 'red':
                    self.bullet = pygame.Rect(self.x, self.y + self.width // 2, 15, 5)
                self.bullets.append(self.bullet)

                BULLET_FIRE_SOUND.play()

        def defaultBulletVel(self):
            self.bulletVel = BULLET_VELL
            self.aimbot = self.realAimbot

        def multi_fire(self):
            num = ((self.max_bullets - len(self.bullets)) * 1.5)
            if num <= 0:
                return
            lastY = self.y
            lastX = self.x
            splits = self.max_bullets - len(self.bullets) - 1
            if splits <= 0:
                return
            self.y = 0
            self.bulletVel = BULLET_VELL * 1.75
            self.aimbot = 0
            for i in range(HEIGHT//splits):
                if i > 4: break
                self.fire()
                self.y += HEIGHT//splits
            self.y = lastY
            self.x = lastX
            threading.Timer(0.2, self.defaultBulletVel).start()

        def un_run(self):
            self.run = False
            self.disable_boost()

        def disable_fire(self):
            self.fired = True

        def not_danger(self):
            self.danger = False

    def __init__(self, **kwargs):
        global MONEY, maxHealth, maxStamina, AIMBOT, MAX_BULLETS, infinityBullets, SUPER_EZ, EZ, HARD, IMPOSSIBLE, \
            BOT_BATTLE
        super(Main, self).__init__(**kwargs)
        clock = pygame.time.Clock()
        work = True
        self.load()
        while work:
            clock.tick(fps)
            WINDOW.blit(self.background1, (0, 0))
            WINDOW.blit(self.background2, (0, self.background1.get_height()))

            def create_button(x, y, width, height, color, text, text_size, cost, text_color=(255, 255, 255)):

                BUTTON_FONT = pygame.font.SysFont('comics', round(WIDTH / text_size))
                button = pygame.Rect(x, y, width, height)
                pygame.draw.rect(MAIN_WINDOW, color, button)
                button_text = BUTTON_FONT.render(text, True, text_color)
                MAIN_WINDOW.blit(button_text, (
                    button.x + 10, button.y + button.height // 3))

                if cost != '':
                    button_text = BUTTON_FONT.render('Cost: ' + str(cost), True, text_color)
                    MAIN_WINDOW.blit(button_text, (
                        button.x + 10, button.y + button.height // 3 + button_text.get_height()))

                return button

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    update_config()
                    pygame.display.quit()
                    pygame.quit()
                    exit()
                if event.type == pygame.MOUSEBUTTONDOWN:
                    my_mouse = pygame.Rect(event.pos[0], event.pos[1], 10, 5)
                    if pygame.mouse.get_pressed()[0]:
                        try:
                            if self.start_button.colliderect(my_mouse):
                                BOT_BATTLE = False
                                work = False

                            elif self.botBattleButton.colliderect(my_mouse):
                                BOT_BATTLE = True
                                work = False

                            elif self.resetButton.colliderect(my_mouse):
                                missing_config()

                            elif self.maxHealth_button.colliderect(my_mouse):
                                if MONEY - 10 >= 0:
                                    maxHealth += 1
                                    MONEY -= 10
                                update_config()

                            elif self.maxStamina_button.colliderect(my_mouse):
                                if MONEY - 10 >= 0:
                                    maxStamina += 10
                                    MONEY -= 10
                                update_config()

                            elif self.MAX_BULLETS_button.colliderect(my_mouse):
                                if MONEY - 25 >= 0:
                                    MAX_BULLETS += 1
                                    MONEY -= 25
                                update_config()

                            elif self.AIMBOT_button.colliderect(my_mouse):
                                if MONEY - 50 >= 0:
                                    AIMBOT += .5
                                    MONEY -= 50
                                update_config()

                            elif self.infinityBullets_button.colliderect(my_mouse):
                                if not infinityBullets:
                                    if MONEY - 150 >= 0:
                                        infinityBullets = True
                                        MONEY -= 150
                                elif infinityBullets:
                                    infinityBullets = False
                                    MONEY += 150
                                update_config()
                            # elif self.money_button.colliderect(my_mouse):
                            #     MONEY += 1
                            elif self.hard_button.colliderect(my_mouse):
                                if HARD:
                                    HARD = False
                                    SUPER_EZ = False
                                    EZ = False
                                    IMPOSSIBLE = True
                                else:
                                    HARD = True
                                    SUPER_EZ = False
                                    EZ = False
                                    IMPOSSIBLE = False
                                update_config()
                            elif self.super_easy_button.colliderect(my_mouse):
                                HARD = False
                                SUPER_EZ = False
                                EZ = True
                                IMPOSSIBLE = False
                                update_config()
                            elif self.easy_button.colliderect(my_mouse):
                                HARD = False
                                SUPER_EZ = True
                                EZ = False
                                IMPOSSIBLE = False
                                update_config()

                        except:
                            pass

                    if pygame.mouse.get_pressed()[2]:
                        try:
                            if self.start_button.colliderect(my_mouse):
                                work = False

                            elif self.maxHealth_button.colliderect(my_mouse):
                                if MONEY + 10 >= 0:
                                    maxHealth -= 1
                                    MONEY += 10
                                update_config()

                            elif self.maxStamina_button.colliderect(my_mouse):
                                if MONEY + 10 >= 0:
                                    maxStamina -= 10
                                    MONEY += 10
                                update_config()

                            elif self.MAX_BULLETS_button.colliderect(my_mouse):
                                if MONEY + 25 >= 0:
                                    MAX_BULLETS -= 1
                                    MONEY += 25
                                update_config()

                            elif self.AIMBOT_button.colliderect(my_mouse):
                                if MONEY + 50 >= 0:
                                    AIMBOT -= .5
                                    MONEY += 50
                                update_config()
                            # elif self.money_button.colliderect(my_mouse):
                            #     MONEY += 1
                        except:
                            pass

            self.start_button = create_button(100, 50, 200, 50, (0, 255, 0), 'Start', 25, '', (0, 0, 0))

            self.money_button = create_button(325, 50, 200, 50, (0, 255, 0), 'Money: ' + str(MONEY), 25, '', (0, 0, 0))

            if SUPER_EZ:
                self.super_easy_button = create_button(550, 50, 80, 50, (0, 255, 0), 'Easy', 25, '', (255, 255, 255))
            else:
                self.easy_button = create_button(550, 50, 80, 50, (100, 100, 100), 'Easy', 25, '')

            if EZ:
                self.super_easy_button = create_button(640, 50, 110, 50, (0, 255, 0), 'Medium', 25, '', (255, 255, 255))
            else:
                self.super_easy_button = create_button(640, 50, 110, 50, (100, 100, 100), 'Medium', 25, '')

            if HARD:
                self.hard_button = create_button(760, 50, 80, 50, (0, 255, 0), 'Hard', 25, '', (255, 255, 255))
            elif IMPOSSIBLE:
                self.hard_button = create_button(760, 50, 120, 50, (0, 255, 0), 'IMPOSSIBLE', 25, '', (255, 255, 255))
            else:
                self.hard_button = create_button(760, 50, 80, 50, (100, 100, 100), 'Hard', 25, '')

            self.botBattleButton = create_button(550, 125, 290, 60, (0, 255, 0), "Bot Battle", 25, '', (0, 0, 0))

            self.resetButton = create_button(550, 210, 290, 60, (255, 0, 0), "Reset Progress", 25, '', (0, 0, 0))

            self.maxHealth_button = create_button(100, 125, 200, 60, (100, 100, 100),
                                                  'Max Health: ' + str(maxHealth), 35, 10)
            self.maxStamina_button = create_button(100, 210, 200, 60, (100, 100, 100),
                                                   'Max Gas: ' + str(maxStamina), 35, 10)
            self.MAX_BULLETS_button = create_button(100, 295, 200, 60, (100, 100, 100),
                                                    'Max Bullets: ' + str(MAX_BULLETS), 35, 25)
            self.AIMBOT_button = create_button(325, 125, 200, 60, (100, 100, 100),
                                               'Aimbot Power: ' + str(AIMBOT), 35, 50)
            self.infinityBullets_button = create_button(325, 210, 200, 60, (100, 100, 100),
                                                        'Infinity Bullets: ' + str(infinityBullets), 35, 150)

            pygame.display.update()

        self.start_game()

    def start_game(self):
        global MONEY
        self.load()
        self.run = False
        self.fire = True
        self.winner = ''
        self.danger = False
        self.order1 = 0
        self.order2 = 0
        self.started = False
        self.impooo = False

        self.yellow = self.CustomRect(0 - 50 - SPACESHIP_HEIGHT
                                      , round(HEIGHT / 2 - SPACESHIP_WIDTH / 2), SPACESHIP_WIDTH - 10,
                                      SPACESHIP_HEIGHT, 'yellow')
        self.yellow.health = maxHealth

        self.red = self.CustomRect(WIDTH + 50
                                   , round(HEIGHT / 2 - SPACESHIP_WIDTH / 2), SPACESHIP_WIDTH - 10,
                                   SPACESHIP_HEIGHT, 'red')

        self.red.health = 10
        self.red.max_stamina = 100
        self.red.max_bullets = 3
        self.red.aimbot = 1
        self.red.infinitybullets = False
        self.red.normal_vel = VEL
        self.impooo = False
        if IMPOSSIBLE:
            self.impooo = True
            self.red.health = 5
            self.red.max_stamina = 100
            self.red.stamina = self.red.max_stamina
            self.red.max_bullets = 10
            self.red.aimbot = 2
            self.red.infinitybullets = True
            self.red.normal_vel = round(VEL * 1.5)
            global HARD
            HARD = True

        self.red.realAimbot = self.red.aimbot
        self.yellow.realAimbot = self.yellow.aimbot

        self.border = pygame.Rect(WIDTH // 2 - 5, 0, 10, HEIGHT)

        clock = pygame.time.Clock()
        self.work = True
        self.draw()
        pygame.time.delay(500)
        self.move_screen()
        while self.work:
            clock.tick(fps)
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.work = False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        return self.__init__()

                if self.started:
                    if event.type == pygame.KEYDOWN:
                        if event.key == pygame.K_SPACE:
                            if self.work:
                                self.yellow.dodge()
                            else:
                                self.yellow.dodge(work=False)
                        if event.key == pygame.K_RETURN:
                            self.yellow.fire()
                    if event.type == pygame.MOUSEBUTTONDOWN:
                        if pygame.mouse.get_pressed()[0]:
                            self.yellow.fire()
                        if pygame.mouse.get_pressed()[2]:
                            self.yellow.multi_fire()
                    if event.type == pygame.JOYBUTTONDOWN:
                        print(event.button)
                        if event.button == 0:
                            if self.work:
                                self.yellow.dodge()
                            else:
                                self.yellow.dodge(work=False)
                        if event.button == 2:
                            self.yellow.fire()
                        if event.button == 3:
                            self.yellow.multi_fire()

                    if event.type == RED_HIT:
                        self.red.health -= 1
                    if event.type == YELLOW_HIT:
                        self.yellow.health -= 1

            if self.winner == 'Red wins!':
                pygame.time.delay(1000)
                self.winner = ''
                return self.__init__()
            elif self.winner == 'Yellow wins!':
                pygame.time.delay(2000)
                self.winner = ''
                return self.__init__()
            if self.red.health <= 0:
                self.winner = 'Yellow wins!'
                if SUPER_EZ:
                    MONEY += 2.5
                elif EZ:
                    MONEY += 5
                elif HARD:
                    MONEY += 10
                if self.impooo:
                    MONEY += 50
                update_config()
            elif self.yellow.health <= 0:
                self.winner = 'Red wins!'
            else:
                self.winner = ''

            if self.yellow.x >= 100 or self.red.x <= WIDTH - 100 or self.started:
                self.started = True

                if BOT_BATTLE:
                    self.bot(self.red, self.yellow)
                    self.bot(self.yellow, self.red)
                else:
                    self.bot(self.red, self.yellow)

                self.handle_bullets()
                self.handle_movement()
                # self.move_screen()
                self.draw()
            else:
                self.draw()
                self.yellow.x += 1
                self.red.x -= 1

        update_config()
        pygame.display.quit()
        pygame.quit()
        exit()

    def load(self):
        self.yellow_ship_image = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'spaceship_yellow.png')), (SPACESHIP_WIDTH, SPACESHIP_HEIGHT)), 0)
        self.red_ship_image = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'spaceship_red.png')), (SPACESHIP_WIDTH, SPACESHIP_HEIGHT)), 0)

        self.yellow_bullet_image = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'yellow_pixel.png')), (BULLET_WIDTH, BULLET_HEIGHT - round(BULLET_HEIGHT / 5))), 0)
        self.red_bullet_image = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'red_pixel.png')), (BULLET_WIDTH, BULLET_HEIGHT)), 0)

        self.yellow_ship_image_off = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'spaceship_yellow_off.png')), (SPACESHIP_WIDTH, SPACESHIP_HEIGHT)), 0)
        self.red_ship_image_off = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'spaceship_red_off.png')), (SPACESHIP_WIDTH, SPACESHIP_HEIGHT)), 0)
        self.yellow_bullet_image_off = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'yellow_pixel_off.png')), (BULLET_WIDTH, BULLET_HEIGHT - round(BULLET_HEIGHT / 5))),
            0)
        self.red_bullet_image_off = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'red_pixel_off.png')), (BULLET_WIDTH, BULLET_HEIGHT)), 0)

        self.yellow_ship_image_half = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'spaceship_yellow_half.png')), (SPACESHIP_WIDTH, SPACESHIP_HEIGHT)), 0)
        self.red_ship_image_half = pygame.transform.rotate(
            pygame.transform.scale(
                pygame.image.load(
                    os.path.join(
                        'Assets', 'spaceship_red_half.png')), (SPACESHIP_WIDTH, SPACESHIP_HEIGHT)), 0)

        self.background1 = pygame.transform.scale(
            pygame.image.load(
                os.path.join(
                    'Assets', 'space1.jpg')), (WIDTH, round(HEIGHT * .8490740)))
        self.background2 = pygame.transform.scale(
            pygame.image.load(
                os.path.join(
                    'Assets', 'space2.jpg')), (WIDTH, round(HEIGHT * .1509259)))

    def draw(self):
        a = ((self.yellow.y + self.yellow.height // 2) - (self.red.y + self.red.height // 2))
        b = ((self.yellow.x + self.yellow.width) - (self.red.x + self.red.width))
        c = math.sqrt(a * a + b * b)
        try:
            if b < 0:
                self.angle = (int(round(math.degrees(math.atan2(a * b, b * c))))) - 90
            elif b >= 0:
                self.angle = (int(round(math.degrees(math.atan2(b * c, c * a))))) - 180
            else:
                self.angle = 90

            self.yellow_ship = pygame.transform.rotate(self.yellow_ship_image_off, self.angle)  # normal
            self.red_ship = pygame.transform.rotate(self.red_ship_image_off, self.angle + 180)

            if abs(self.yellow.speed_x) > 0 or abs(self.yellow.speed_y) > 0:  # wawlk
                self.yellow_ship = pygame.transform.rotate(self.yellow_ship_image_half, self.angle)
            if abs(self.red.speed_x) > 0 or abs(self.red.speed_y) > 0:
                self.red_ship = pygame.transform.rotate(self.red_ship_image_half, self.angle + 180)

            if abs(self.yellow.speed_x) > VEL or abs(self.yellow.speed_y) > VEL:  # run
                self.yellow_ship = pygame.transform.rotate(self.yellow_ship_image, self.angle)
            if abs(self.red.speed_x) > VEL or abs(self.red.speed_y) > VEL:
                self.red_ship = pygame.transform.rotate(self.red_ship_image, self.angle + 180)
        except:
            self.yellow_ship = pygame.transform.rotate(self.yellow_ship_image_off, self.angle)
            self.red_ship = pygame.transform.rotate(self.red_ship_image_off, self.angle + 180)

        WINDOW.blit(self.background1, (self.order2, 0))
        WINDOW.blit(self.background1, (WIDTH + self.order2, 0))

        WINDOW.blit(self.background2, (self.order1, self.background1.get_height()))
        WINDOW.blit(self.background2, (WIDTH + self.order1, self.background1.get_height()))

        # pygame.draw.rect(WINDOW, (255, 255, 255), pygame.Rect(WIDTH + (self.order2), 0, 5, HEIGHT))

        red_health_text = HEALTH_FONT.render(
            (' Gas: ' + str(int(self.red.stamina * 100 / self.red.max_stamina)) + '%' + ' Health: ' + str(int(self.red.health))
             ), True, (255, 255, 255))
        yellow_health_text = HEALTH_FONT.render(
            (' Gas: ' + str(int(self.yellow.stamina * 100 / self.yellow.max_stamina)) + '%' + ' Health: ' + str(int(self.yellow.health))
             ), True, (255, 255, 255))

        WINDOW.blit(red_health_text, (WIDTH - red_health_text.get_width() - 10, 10))
        WINDOW.blit(yellow_health_text, (10, 10))

        WINDOW.blit(self.yellow_ship, (self.yellow.x, self.yellow.y))
        WINDOW.blit(self.red_ship, (self.red.x, self.red.y))

        pygame.draw.rect(WINDOW, (0, 0, 0), self.border)

        for bullet in self.yellow.bullets:

            a = ((bullet.y + bullet.height // 2) - (self.red.y + self.red.height // 2))
            b = ((bullet.x + bullet.width) - (self.red.x + self.red.width))
            c = math.sqrt(a * a + b * b)
            try:
                if b < 0:
                    self.angle = (int(round(math.degrees(math.atan2(a * b, b * c))))) - 90
                self.yellow_bullet = pygame.transform.rotate(self.yellow_bullet_image, self.angle + 180)
                if bullet.x > self.red.x:
                    self.yellow_bullet = pygame.transform.rotate(self.yellow_bullet_image_off, self.angle + 180)
            except:
                self.yellow_bullet = pygame.transform.rotate(self.yellow_bullet_image, 270)

            WINDOW.blit(self.yellow_bullet, (bullet.x - 5, bullet.y - bullet.height))
        for bullet in self.red.bullets:

            a = ((bullet.y + bullet.height // 2) - (self.yellow.y + self.yellow.height // 2))
            b = ((bullet.x + bullet.width) - (self.yellow.x + self.yellow.width))
            c = math.sqrt(a * a + b * b)
            try:
                if b > 0:
                    self.angle = (int(round(math.degrees(math.atan2(b * c, b * a)))))
                self.red_bullet = pygame.transform.rotate(self.red_bullet_image, self.angle)
                if bullet.x < self.yellow.x:
                    self.red_bullet = pygame.transform.rotate(self.red_bullet_image_off, self.angle)
            except:
                self.red_bullet = pygame.transform.rotate(self.red_bullet_image, 90)

            WINDOW.blit(self.red_bullet, (bullet.x, bullet.y - bullet.height))

        draw_text = WINNER_FONT.render(self.winner, True, (255, 255, 255))
        WINDOW.blit(draw_text, (WIDTH / 2 - draw_text.get_width() / 2, HEIGHT / 2 - draw_text.get_height() // 2))

        pygame.display.update()

    def move_screen(self):
        self.order1 -= VEL
        if self.order1 < -(WIDTH):
            self.order1 = 0
        self.order2 -= VEL / 2
        if self.order2 < -(WIDTH):
            self.order2 = 0
        if self.work and self.winner == '':
            return threading.Timer(.01, self.move_screen).start()

    def handle_movement(self):
        global EZ, SUPER_EZ
        self.yellow.before_moving()
        # self.red.before_moving()

        key_pressed = pygame.key.get_pressed()
        try:
            con_move = JOYSTICK[0].get_hat(0)
            con_x = JOYSTICK[0].get_axis(0)
            con_y = JOYSTICK[0].get_axis(1)
            con_r2 = JOYSTICK[0].get_axis(5)
        except IndexError:
            con_move = (0, 0)
            con_x = 0
            con_y = 0
            con_r2 = -1
        except:
            con_move = (0, 0)
            con_x = 0
            con_y = 0
            con_r2 = -1
        # print(JOYSTICK[0].get_axis(5))

        if key_pressed[pygame.K_d] or con_move[0] > 0 or con_x > 0.1:  # Normal movement
            self.yellow.move_right()
            # self.red.move_right()
        if key_pressed[pygame.K_a] or con_move[0] < 0 or con_x < -0.1:
            self.yellow.move_left()
            # self.red.move_left()
        if key_pressed[pygame.K_w] or con_move[1] > 0 or con_y < -0.1:
            self.yellow.move_up()
            # self.red.move_up()
        if key_pressed[pygame.K_s] or con_move[1] < 0 or con_y > 0.1:
            self.yellow.move_down()
            # self.red.move_down()

        if key_pressed[pygame.K_LSHIFT] or con_r2 > -.5:  # Boost
            self.yellow.boost()
            # self.red.boost()
        else:
            self.yellow.disable_boost()
            # self.red.disable_boost()

        self.yellow.after_moving()
        # self.red.after_moving()

    def handle_bullets(self):
        for bullet in self.yellow.bullets:
            bullet.x += self.yellow.bulletVel
            if bullet.y != self.red.y + self.red.width // 2 and bullet.x < self.red.x:
                if bullet.y < self.red.y + self.red.width // 2:
                    bullet.y += round(VEL * self.yellow.aimbot)
                elif bullet.y > self.red.y + self.red.width // 2:
                    bullet.y -= round(VEL * self.yellow.aimbot)
            if not self.red.immune:
                if bullet.colliderect(self.red):
                    pygame.event.post(pygame.event.Event(RED_HIT))
                    self.yellow.bullets.remove(bullet)
                    BULLET_HIT_SOUND.play()

            if not self.yellow.infinitybullets:
                if bullet.x > WIDTH: self.yellow.bullets.remove(bullet)
            elif self.yellow.infinitybullets:
                if bullet.x > WIDTH: bullet.x = 0 - BULLET_HEIGHT - random.randint(0, 20)

        for bullet in self.red.bullets:
            bullet.x -= self.red.bulletVel
            if bullet.y != self.yellow.y + self.yellow.width // 2 and bullet.x > self.yellow.x:
                if bullet.y < self.yellow.y + self.yellow.width // 2:
                    bullet.y += VEL * self.red.aimbot
                elif bullet.y > self.yellow.y + self.yellow.width // 2:
                    bullet.y -= VEL * self.red.aimbot
            if not self.yellow.immune:
                if bullet.colliderect(self.yellow):
                    pygame.event.post(pygame.event.Event(YELLOW_HIT))
                    self.red.bullets.remove(bullet)
                    BULLET_HIT_SOUND.play()

            try:
                if not self.red.infinitybullets:
                    if bullet.x + bullet.height < 0: self.red.bullets.remove(bullet)
                elif self.red.infinitybullets:
                    if bullet.x + bullet.height < 0: bullet.x = WIDTH + random.randint(5, 25)
            except: pass

    def bot(self, bot, target):
        bot.before_moving()
        if not bot.run:
            bot.disable_boost()

        for bullet in target.bullets:
            if not EZ:
                if bullet.y + round(HEIGHT / 10) > bot.middle_y > bullet.y - round(HEIGHT / 10) and \
                        bullet.x + bullet.width + round(
                    WIDTH / 6) > bot.middle_x > bullet.x + bullet.width - round(WIDTH / 6):
                    bot.boost()
                    bot.run = True
                    if self.work:
                        unrun = threading.Timer(.25, bot.un_run)
                        unrun.start()

        if not bot.run:
            if bot.middle_y >= target.middle_y:
                bot.move_up()
            elif bot.middle_y < target.middle_y:
                bot.move_down()
            if abs((bot.x + 5) - target.x) > abs(bot.x - target.x):
                bot.move_right()
            else:
                bot.move_left()

        if bot.run:
            if bot.middle_y < target.middle_y:
                bot.move_up()
            elif bot.middle_y >= target.middle_y:
                bot.move_down()
            if abs((bot.x + 5) - target.x) > abs(bot.x - target.x):
                bot.move_left()
            else:
                bot.move_right()

        for bullet in target.bullets:
            if not EZ and not SUPER_EZ:
                if bullet.y + round(HEIGHT / 16.66) > bot.middle_y > bullet.y - round(HEIGHT / 16.66) and \
                        bullet.x + bullet.width + round(
                    WIDTH / 12.85) > bot.middle_x > bullet.x + bullet.width - round(WIDTH / 12.85):
                    if self.work:
                        bot.dodge()
                    else:
                        bot.dodge(work=False)
                    bot.disable_boost()
            if EZ and not SUPER_EZ:
                if bullet.y + round(HEIGHT / 14) > bot.middle_y > bullet.y - round(HEIGHT / 14) and \
                        bullet.x + bullet.width + round(
                    WIDTH / 12.85) > bot.middle_x > bullet.x + bullet.width - round(WIDTH / 12.85):
                    if self.work:
                        bot.dodge(ez=True)
                    else:
                        bot.dodge(ez=True, work=False)
                    bot.disable_boost()

        if target.y + round(HEIGHT / 5) > bot.middle_y > target.y - round(HEIGHT / 5):
            if bot.fired:
                bot.fired = False
                bot.fire()
                if self.work: threading.Timer((random.randint(1, 5) / 10), bot.disable_fire).start()

        if random.randint(0, 250) == 125:
            bot.fire()

        if random.randint(0, 150) == 60:
            if len(bot.bullets) <= bot.max_bullets - 2:
                bot.multi_fire()

        bot.after_moving()


if __name__ == '__main__':
    game = Main()
