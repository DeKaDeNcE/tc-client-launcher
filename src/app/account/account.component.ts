import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/takeUntil';

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ElectronService } from 'ngx-electron';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { LaunchArgs } from '../../electron/launch-args';
import { Logger } from '../../electron/logger';
import { ConfigurationService } from '../configuration.service';
import { LoginTicketService } from '../login-ticket.service';
import { GameAccountInfo, GameAccountList } from './game-account-info';

const ExpansionNames = [
    'World of Warcraft',
    'The Burning Crusade',
    'Wrath of the Lich King',
    'Cataclysm',
    'Mists of Pandaria',
    'Warlords of Draenor',
    'Legion'
];

const NO_GAME_ACCOUNT: GameAccountInfo = {
    display_name: 'No game accounts',
    expansion: 0,
    is_suspended: true,
    is_banned: true,
    suspension_expires: 0,
    suspension_reason: ''
};

@Component({
    selector: 'tc-account',
    templateUrl: './account.component.html',
    styleUrls: ['./account.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountComponent implements OnInit, OnDestroy {

    gameAccounts: GameAccountInfo[] = [];
    selectedGameAccount: GameAccountInfo;
    noGameAccounts: boolean;
    hasRecentlyLaunched: boolean;

    private destroyed = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private loginTicket: LoginTicketService,
        private electronService: ElectronService,
        private configuration: ConfigurationService,
        private changeDetector: ChangeDetectorRef,
        private logger: Logger) {
    }

    ngOnInit(): void {
        const gameAccounts = <GameAccountList>this.route.snapshot.data['gameAccounts'];
        this.gameAccounts = gameAccounts.game_accounts || [];
        this.noGameAccounts = this.gameAccounts.length === 0;
        const lastAccount = this.gameAccounts.find(gameAccount => gameAccount.display_name === this.configuration.LastGameAccount);
        if (this.gameAccounts.length === 0) {
            this.gameAccounts = [NO_GAME_ACCOUNT];
        }
        this.selectedGameAccount = lastAccount || this.gameAccounts[0];
        this.electronService.ipcRenderer.send('login');
        this.logger.log('Account | Initialized account view', this.gameAccounts.map(gameAccount => gameAccount.display_name),
            `last selected game account: ${lastAccount ? lastAccount.display_name : 'none'}`);
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    launch(): void {
        const launchArgs = new LaunchArgs();
        launchArgs.Portal = this.route.snapshot.data['portal'];
        launchArgs.LoginTicket = this.loginTicket.getTicket();
        launchArgs.GameAccount = this.selectedGameAccount.display_name;
        this.electronService.ipcRenderer.send('launcher', launchArgs);
        this.configuration.LastGameAccount = this.selectedGameAccount.display_name;
        this.logger.log(`Account | Launching game with account ${launchArgs.GameAccount} and portal ${launchArgs.Portal}`);
        this.hasRecentlyLaunched = true;
        Observable.timer(5000).takeUntil(this.destroyed).subscribe(() => {
            this.logger.log('Account | Re-enabling launch button');
            this.hasRecentlyLaunched = false;
            this.changeDetector.markForCheck();
        });
    }

    launchEnabled(): boolean {
        return !this.hasRecentlyLaunched && !this.selectedGameAccount.is_suspended && !this.selectedGameAccount.is_banned;
    }

    formatExpansionName(expansionIndex: number): string {
        return ExpansionNames[expansionIndex];
    }

    formatBanExpirationTime(expirationUnixTimestamp: number): string {
        const options = { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };
        return new Date(expirationUnixTimestamp * 1000).toLocaleString([], options);
    }
}
