import React from 'react';
import {MuiThemeProvider, withStyles} from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import GenericApp from '@iobroker/adapter-react/GenericApp';
import Loader from '@iobroker/adapter-react/Components/Loader'

import I18n from '@iobroker/adapter-react/i18n';
import TabOptions from './Tabs/Options';
import TabResources from './Tabs/Resources';
import TabStations from './Tabs/Stations';
import TabLicense from './Tabs/License';

const styles = theme => ({
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto'
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto'
    }
});

class App extends GenericApp {
    constructor(props) {
        const extendedProps = {};
        extendedProps.translations = {
            'en': require('./i18n/en'),
            'de': require('./i18n/de'),
            'ru': require('./i18n/ru'),
            'pt': require('./i18n/pt'),
            'nl': require('./i18n/nl'),
            'fr': require('./i18n/fr'),
            'it': require('./i18n/it'),
            'es': require('./i18n/es'),
            'pl': require('./i18n/pl'),
            'zh-cn': require('./i18n/zh-cn'),
        };
        extendedProps.doNotLoadAllObjects = true;
        extendedProps.adapterName = 'consumption';

        super(props, extendedProps);
    }

    getSelectedTab() {
        const tab = this.state.selectedTab;
        if (!tab || tab === 'undefined' || tab === 'options') {
            return 0;
        } else
        if (tab === 'resources') {
            return 1;
        } else
        if (tab === 'stations') {
            return 2;
        } else
        if (tab === 'license') {
            return 3;
        }
    }

    render() {
        if (!this.state.loaded) {
            return <MuiThemeProvider theme={this.state.theme}>
                <Loader theme={this.state.themeType}/>
            </MuiThemeProvider>;
        }

        return <MuiThemeProvider theme={this.state.theme}>
            <div className="App" style={{background: this.state.themeType === 'dark' ? '#000' : '#FFF'}}>
                <AppBar position="static">
                    <Tabs value={this.getSelectedTab()} onChange={(e, index) => this.selectTab(e.target.parentNode.dataset.name, index)}>
                        <Tab label={I18n.t('Options')}   data-name="options" />
                        <Tab label={I18n.t('Resources')} data-name="resources" />
                        <Tab label={I18n.t('Stations')}  data-name="stations" />
                        <Tab label={I18n.t('License')}   data-name="license" />
                    </Tabs>
                </AppBar>

                <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>
                    {(this.state.selectedTab === 'options' || !this.state.selectedTab) && (<TabOptions
                        key="options"
                        common={this.common}
                        socket={this.socket}
                        native={this.state.native}
                        theme={this.state.themeType}
                        onError={text => this.setState({errorText: text})}
                        onLoad={native => this.onLoadConfig(native)}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    />)}
                    {this.state.selectedTab === 'resources' && <TabResources
                        key="resources"
                        common={this.common}
                        socket={this.socket}
                        themeType={this.state.themeType}
                        attributeName="resources"
                        theme={this.state.theme}
                        native={this.state.native}
                        onError={text => this.setState({errorText: text})}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    />}
                    {this.state.selectedTab === 'stations' && <TabStations
                        key="stations"
                        common={this.common}
                        socket={this.socket}
                        attributeName="stations"
                        themeType={this.state.themeType}
                        theme={this.state.theme}
                        native={this.state.native}
                        onError={text => this.setState({errorText: text})}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    />}
                    {this.state.selectedTab === 'license' && <TabLicense
                        key="license"
                        common={this.common}
                        socket={this.socket}
                        themeType={this.state.themeType}
                        theme={this.state.theme}
                        native={this.state.native}
                        onError={text => this.setState({errorText: text})}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        />}
                </div>
                {this.renderError()}
                {this.renderSaveCloseButtons()}
            </div>
        </MuiThemeProvider>;
    }
}

export default withStyles(styles)(App);