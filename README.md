# The flow of underage asylum seekers travelling alone to Finland

A visualization of the flow of underage asylum seekers to Finland from 2011 onwards. Based on our [visualization of asylum applicants in Europe](https://github.com/lucified/lucify-refugees). See it in action [here](http://underage-asylum.saarinen.info/).

This project uses a combination of [React](https://facebook.github.io/react/), [D3.js](http://d3js.org/) and [PIXI.js](http://www.pixijs.com/).


## Development

### Dependencies

- Node + npm
- Ruby + [RubyGems](https://rubygems.org/pages/download)
- Bundler: `gem install bundler`
- GDAL (<http://www.gdal.org/>). On OS X with homebrew install with `brew install gdal`.

### Setup and running

Run the following in the project directory:

1. `npm install`
2. `bundle install`
3. `gulp` or `node ./node_modules/gulp/bin/gulp.js`

This project requires gulp 4.0, which is installed by `npm install` under `node_modules`. To be able to use the plain `gulp` command as above, make sure you have gulp-cli version 0.4 installed:
```
npm install gulpjs/gulp-cli#4.0 -g
```

## Data source

The visualization is based on data from the [Finnish Immigration Service](http://www.migri.fi/tietoa_virastosta/tilastot/turvapaikka-_ja_pakolaistilastot).

## Authors

Have feedback? Contact us!

- [Juho Ojala](https://twitter.com/ojalajuho)
- [Ville Saarinen](https://twitter.com/vsaarinen)

## License

This project is released under the [MIT license](LICENSE).
